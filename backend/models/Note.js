const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  eleve: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Eleve', 
    required: true 
  },
  matiere: { 
    type: String, 
    required: true,
    enum: [
      'Mathématiques', 'Français', 'Anglais', 'Histoire-Géo',
      'Sciences', 'Physique-Chimie', 'SVT', 'Philosophie',
      'Informatique', 'EPS', 'Arts', 'Arabe', 'Wolof',
      'Éducation Civique', 'Technologie', 'Espagnol'
    ]
  },
  typeNote: {
    type: String,
    enum: ['Devoir1', 'Devoir2', 'Composition'],
    required: true
  },
  note: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 20 
  },
  coefficient: { 
    type: Number, 
    required: true,
    enum: [1, 2, 3, 4, 5]
  },
  trimestre: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 3 
  },
  anneeScolaire: { 
    type: String, 
    required: true,
    default: '2023-2024'
  },
  dateEvaluation: { 
    type: Date, 
    default: Date.now 
  },
  remarque: { type: String }
}, { timestamps: true });

// Calculer la moyenne selon le modèle sénégalais (Devoir1 + Devoir2 + Composition)
noteSchema.statics.calculerMoyenneMatiere = async function(eleveId, matiere, trimestre, anneeScolaire) {
  const notes = await this.find({ 
    eleve: eleveId,
    matiere,
    trimestre, 
    anneeScolaire 
  });
  
  // Vérifier qu'on a les 3 notes requises
  const devoir1 = notes.find(n => n.typeNote === 'Devoir1');
  const devoir2 = notes.find(n => n.typeNote === 'Devoir2');
  const composition = notes.find(n => n.typeNote === 'Composition');
  
  if (!devoir1 || !devoir2 || !composition) {
    return null; // Notes incomplètes
  }
  
  // Calcul selon modèle sénégalais : Moyenne = (D1 + D2 + 2*Comp) / 4
  const moyenne = (devoir1.note + devoir2.note + (2 * composition.note)) / 4;
  
  return {
    moyenne: parseFloat(moyenne.toFixed(2)),
    details: {
      devoir1: devoir1.note,
      devoir2: devoir2.note,
      composition: composition.note
    }
  };
};

// Calculer la moyenne générale du trimestre
noteSchema.statics.calculerMoyenneGenerale = async function(eleveId, trimestre, anneeScolaire) {
  const notes = await this.find({ 
    eleve: eleveId,
    trimestre, 
    anneeScolaire 
  });
  
  // Regrouper par matière
  const matieres = [...new Set(notes.map(n => n.matiere))];
  
  let totalPoints = 0;
  let totalCoefficients = 0;
  const moyennesMatieres = [];
  
  for (const matiere of matieres) {
    const moyenneMatiere = await this.calculerMoyenneMatiere(eleveId, matiere, trimestre, anneeScolaire);
    
    if (moyenneMatiere !== null) {
      const coefficient = notes.find(n => n.matiere === matiere).coefficient;
      totalPoints += moyenneMatiere.moyenne * coefficient;
      totalCoefficients += coefficient;
      
      moyennesMatieres.push({
        matiere,
        coefficient,
        moyenne: moyenneMatiere.moyenne,
        details: moyenneMatiere.details
      });
    }
  }
  
  if (totalCoefficients === 0) return null;
  
  const moyenneGenerale = totalPoints / totalCoefficients;
  
  return {
    moyenneGenerale: parseFloat(moyenneGenerale.toFixed(2)),
    moyennesMatieres,
    totalCoefficients
  };
};

module.exports = mongoose.model('Note', noteSchema);
