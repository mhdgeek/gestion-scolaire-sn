const mongoose = require('mongoose');

const classeSchema = new mongoose.Schema({
  nom: { type: String, required: true, unique: true },
  niveau: { 
    type: String, 
    required: true, 
    enum: ['Préscolaire', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nd', '1ère', 'Tle'] 
  },
  serie: {
    type: String,
    enum: ['Générale', 'L', 'S', 'ES', 'Technique', null],
    default: null
  },
  effectif: { type: Number, default: 0 },
  professeurPrincipal: { type: String, required: true },
  capaciteMax: { type: Number, default: 40 },
  anneeScolaire: { type: String, default: '2023-2024' }
}, { timestamps: true });

// Mettre à jour l'effectif lorsqu'un élève est ajouté/supprimé
classeSchema.methods.updateEffectif = async function() {
  const Eleve = require('./Eleve');
  const count = await Eleve.countDocuments({ classe: this._id });
  this.effectif = count;
  await this.save();
  return count;
};

module.exports = mongoose.model('Classe', classeSchema);
