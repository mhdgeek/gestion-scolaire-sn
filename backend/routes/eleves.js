const express = require('express');
const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const Note = require('../models/Note');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all élèves avec classes et notes
router.get('/', auth, async (req, res) => {
  try {
    const { classe, search } = req.query;
    
    let query = {};
    
    if (classe) {
      query.classe = classe;
    }
    
    if (search) {
      query.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { prenom: { $regex: search, $options: 'i' } },
        { matricule: { $regex: search, $options: 'i' } }
      ];
    }
    
    const eleves = await Eleve.find(query)
      .populate('classe', 'nom niveau')
      .sort({ nom: 1, prenom: 1 });
    
    res.json(eleves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get élève by ID avec notes et classe
router.get('/:id', auth, async (req, res) => {
  try {
    const eleve = await Eleve.findById(req.params.id).populate('classe');
    
    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    
    // Récupérer les notes par trimestre
    const notesParTrimestre = {};
    
    for (let trimestre = 1; trimestre <= 3; trimestre++) {
      const notes = await Note.find({ 
        eleve: req.params.id,
        trimestre,
        anneeScolaire: '2023-2024'
      }).sort('matiere');
      
      notesParTrimestre[`trimestre${trimestre}`] = notes;
      
      // Calculer la moyenne du trimestre
      if (notes.length > 0) {
        const totalPoints = notes.reduce((sum, note) => sum + (note.note * note.coefficient), 0);
        const totalCoefficients = notes.reduce((sum, note) => sum + note.coefficient, 0);
        notesParTrimestre[`moyenneTrimestre${trimestre}`] = totalPoints / totalCoefficients;
      }
    }
    
    res.json({ eleve, ...notesParTrimestre });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new élève
router.post('/', auth, async (req, res) => {
  try {
    // Vérifier si la classe existe
    const classe = await Classe.findById(req.body.classe);
    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    
    // Vérifier la capacité de la classe
    if (classe.effectif >= classe.capaciteMax) {
      return res.status(400).json({ message: 'La classe a atteint sa capacité maximale' });
    }
    
    const eleve = new Eleve(req.body);
    await eleve.save();
    
    // Mettre à jour l'effectif de la classe
    await classe.updateEffectif();
    
    res.status(201).json(eleve);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update élève
router.put('/:id', auth, async (req, res) => {
  try {
    const eleve = await Eleve.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('classe');
    
    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    
    // Si la classe a changé, mettre à jour les effectifs
    if (req.body.classe) {
      const ancienneClasse = await Classe.findById(eleve.classe._id);
      const nouvelleClasse = await Classe.findById(req.body.classe);
      
      if (ancienneClasse) await ancienneClasse.updateEffectif();
      if (nouvelleClasse) await nouvelleClasse.updateEffectif();
    }
    
    res.json(eleve);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete élève
router.delete('/:id', auth, async (req, res) => {
  try {
    const eleve = await Eleve.findById(req.params.id);
    
    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    
    // Supprimer les notes de l'élève
    await Note.deleteMany({ eleve: req.params.id });
    
    // Supprimer l'élève
    await Eleve.findByIdAndDelete(req.params.id);
    
    // Mettre à jour l'effectif de la classe
    const classe = await Classe.findById(eleve.classe);
    if (classe) {
      await classe.updateEffectif();
    }
    
    res.json({ message: 'Élève et ses notes supprimés avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Statistiques par classe
router.get('/stats/classe/:classeId', auth, async (req, res) => {
  try {
    const eleves = await Eleve.find({ classe: req.params.classeId });
    const stats = {
      total: eleves.length,
      garcons: eleves.filter(e => e.sexe === 'M').length,
      filles: eleves.filter(e => e.sexe === 'F').length,
      nouveaux: eleves.filter(e => e.situation === 'Nouveau').length,
      reinscrits: eleves.filter(e => e.situation === 'Réinscrit').length
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
