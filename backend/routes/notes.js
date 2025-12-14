const express = require('express');
const Note = require('../models/Note');
const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all notes avec filtres
router.get('/', auth, async (req, res) => {
  try {
    const { classe, trimestre, matiere, eleve, typeNote } = req.query;
    
    let query = {};
    
    if (trimestre) query.trimestre = trimestre;
    if (matiere) query.matiere = matiere;
    if (eleve) query.eleve = eleve;
    if (typeNote) query.typeNote = typeNote;
    
    // Si classe est spécifiée, trouver les élèves de cette classe
    if (classe) {
      const eleves = await Eleve.find({ classe }).select('_id');
      const eleveIds = eleves.map(e => e._id);
      query.eleve = { $in: eleveIds };
    }
    
    const notes = await Note.find(query)
      .populate('eleve', 'matricule nom prenom classe')
      .populate('eleve.classe', 'nom niveau')
      .sort({ trimestre: 1, matiere: 1, typeNote: 1 });
    
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new note
router.post('/', auth, async (req, res) => {
  try {
    // Vérifier si la note existe déjà pour cet élève, matière, type et trimestre
    const noteExistante = await Note.findOne({
      eleve: req.body.eleve,
      matiere: req.body.matiere,
      typeNote: req.body.typeNote,
      trimestre: req.body.trimestre,
      anneeScolaire: req.body.anneeScolaire || '2023-2024'
    });
    
    if (noteExistante) {
      return res.status(400).json({ 
        message: `Une ${req.body.typeNote} existe déjà pour cet élève, matière et trimestre` 
      });
    }
    
    const note = new Note(req.body);
    await note.save();
    
    await note.populate('eleve', 'matricule nom prenom');
    
    res.status(201).json(note);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update note
router.put('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('eleve', 'matricule nom prenom');
    
    if (!note) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }
    
    res.json(note);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete note
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }
    
    res.json({ message: 'Note supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulletin d'un élève selon modèle sénégalais
router.get('/bulletin/:eleveId/:trimestre', auth, async (req, res) => {
  try {
    const { eleveId, trimestre } = req.params;
    
    // Récupérer l'élève avec sa classe
    const eleve = await Eleve.findById(eleveId).populate('classe');
    
    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    
    // Calculer la moyenne générale
    const moyenneGenerale = await Note.calculerMoyenneGenerale(eleveId, parseInt(trimestre), '2023-2024');
    
    // Récupérer toutes les notes du trimestre
    const notes = await Note.find({
      eleve: eleveId,
      trimestre: parseInt(trimestre),
      anneeScolaire: '2023-2024'
    }).sort('matiere typeNote');
    
    // Regrouper par matière
    const notesParMatiere = {};
    notes.forEach(note => {
      if (!notesParMatiere[note.matiere]) {
        notesParMatiere[note.matiere] = [];
      }
      notesParMatiere[note.matiere].push(note);
    });
    
    // Déterminer l'appréciation selon le système sénégalais
    const determinerAppreciation = (moyenne) => {
      if (moyenne >= 16) return 'Excellent';
      if (moyenne >= 14) return 'Très Bien';
      if (moyenne >= 12) return 'Bien';
      if (moyenne >= 10) return 'Assez Bien';
      if (moyenne >= 8) return 'Passable';
      return 'Insuffisant';
    };
    
    // Déterminer la mention selon le système sénégalais
    const determinerMention = (moyenne) => {
      if (moyenne >= 16) return 'Excellente';
      if (moyenne >= 14) return 'Très Bien';
      if (moyenne >= 12) return 'Bien';
      if (moyenne >= 10) return 'Assez Bien';
      if (moyenne >= 8) return 'Passable';
      return 'Insuffisant';
    };
    
    res.json({
      eleve,
      trimestre: parseInt(trimestre),
      notesParMatiere,
      moyenneGenerale: moyenneGenerale?.moyenneGenerale || null,
      moyennesMatieres: moyenneGenerale?.moyennesMatieres || [],
      appreciationGenerale: moyenneGenerale ? determinerAppreciation(moyenneGenerale.moyenneGenerale) : 'Non évalué',
      mention: moyenneGenerale ? determinerMention(moyenneGenerale.moyenneGenerale) : 'Non évalué',
      anneeScolaire: '2023-2024',
      dateGeneration: new Date(),
      totalCoefficients: moyenneGenerale?.totalCoefficients || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Moyennes par classe avec classement
router.get('/moyennes/classe/:classeId/:trimestre', auth, async (req, res) => {
  try {
    const { classeId, trimestre } = req.params;
    
    // Récupérer tous les élèves de la classe
    const eleves = await Eleve.find({ classe: classeId });
    
    const moyennes = [];
    
    for (const eleve of eleves) {
      const moyenneData = await Note.calculerMoyenneGenerale(eleve._id, parseInt(trimestre), '2023-2024');
      
      moyennes.push({
        eleve: {
          _id: eleve._id,
          matricule: eleve.matricule,
          nom: eleve.nom,
          prenom: eleve.prenom,
          sexe: eleve.sexe
        },
        moyenneGenerale: moyenneData?.moyenneGenerale || null,
        moyennesMatieres: moyenneData?.moyennesMatieres || [],
        totalCoefficients: moyenneData?.totalCoefficients || 0,
        complet: moyenneData !== null // Si toutes les matières sont complètes
      });
    }
    
    // Trier par moyenne décroissante (éliminer les null)
    const moyennesValides = moyennes.filter(m => m.moyenneGenerale !== null);
    const moyennesNonValides = moyennes.filter(m => m.moyenneGenerale === null);
    
    moyennesValides.sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);
    
    // Calculer les rangs
    moyennesValides.forEach((moyenne, index) => {
      moyenne.rang = index + 1;
    });
    
    const resultat = [...moyennesValides, ...moyennesNonValides];
    
    // Statistiques de la classe
    const stats = {
      totalEleves: eleves.length,
      elevesComplets: moyennesValides.length,
      elevesIncomplets: moyennesNonValides.length,
      moyenneClasse: moyennesValides.length > 0 ? 
        moyennesValides.reduce((sum, m) => sum + m.moyenneGenerale, 0) / moyennesValides.length : 0,
      meilleureMoyenne: moyennesValides.length > 0 ? moyennesValides[0].moyenneGenerale : 0,
      pireMoyenne: moyennesValides.length > 0 ? moyennesValides[moyennesValides.length - 1].moyenneGenerale : 0
    };
    
    res.json({
      moyennes: resultat,
      stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Vérification des notes par matière pour un élève
router.get('/verification/:eleveId/:matiere/:trimestre', auth, async (req, res) => {
  try {
    const { eleveId, matiere, trimestre } = req.params;
    
    const notes = await Note.find({
      eleve: eleveId,
      matiere,
      trimestre: parseInt(trimestre),
      anneeScolaire: '2023-2024'
    });
    
    const devoir1 = notes.find(n => n.typeNote === 'Devoir1');
    const devoir2 = notes.find(n => n.typeNote === 'Devoir2');
    const composition = notes.find(n => n.typeNote === 'Composition');
    
    const complet = devoir1 && devoir2 && composition;
    
    res.json({
      complet,
      notes: {
        devoir1: devoir1?.note || null,
        devoir2: devoir2?.note || null,
        composition: composition?.note || null
      },
      moyenne: complet ? (devoir1.note + devoir2.note + (2 * composition.note)) / 4 : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
