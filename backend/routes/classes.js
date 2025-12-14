const express = require('express');
const Classe = require('../models/Classe');
const Eleve = require('../models/Eleve');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all classes avec élèves
router.get('/', auth, async (req, res) => {
  try {
    const classes = await Classe.find().sort('niveau');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get classe by ID avec élèves
router.get('/:id', auth, async (req, res) => {
  try {
    const classe = await Classe.findById(req.params.id);
    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    
    const eleves = await Eleve.find({ classe: req.params.id })
      .select('matricule nom prenom sexe dateNaissance')
      .sort('nom');
    
    res.json({ classe, eleves });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new classe
router.post('/', auth, async (req, res) => {
  try {
    // Vérifier si la classe existe déjà
    const classeExistante = await Classe.findOne({ 
      nom: req.body.nom,
      niveau: req.body.niveau,
      anneeScolaire: req.body.anneeScolaire || '2023-2024'
    });
    
    if (classeExistante) {
      return res.status(400).json({ message: 'Cette classe existe déjà' });
    }
    
    const classe = new Classe(req.body);
    await classe.save();
    res.status(201).json(classe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update classe
router.put('/:id', auth, async (req, res) => {
  try {
    const classe = await Classe.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    
    res.json(classe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete classe (seulement si vide)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Vérifier si la classe a des élèves
    const elevesCount = await Eleve.countDocuments({ classe: req.params.id });
    
    if (elevesCount > 0) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer une classe contenant des élèves' 
      });
    }
    
    const classe = await Classe.findByIdAndDelete(req.params.id);
    
    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    
    res.json({ message: 'Classe supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Statistiques des classes
router.get('/stats/effectifs', auth, async (req, res) => {
  try {
    const stats = await Classe.aggregate([
      {
        $group: {
          _id: '$niveau',
          totalEffectif: { $sum: '$effectif' },
          nombreClasses: { $sum: 1 },
          capaciteTotale: { $sum: '$capaciteMax' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
