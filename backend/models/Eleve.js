const mongoose = require('mongoose');

const eleveSchema = new mongoose.Schema({
  matricule: { 
    type: String, 
    required: true, 
    unique: true 
  },
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  dateNaissance: { type: Date, required: true },
  lieuNaissance: { type: String, required: true },
  sexe: { type: String, enum: ['M', 'F'], required: true },
  adresse: { type: String, required: true },
  telephone: { type: String },
  email: { type: String },
  classe: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Classe', 
    required: true 
  },
  nomPere: { type: String, required: true },
  professionPere: { type: String },
  nomMere: { type: String, required: true },
  professionMere: { type: String },
  telephoneParent: { type: String, required: true },
  dateInscription: { type: Date, default: Date.now },
  situation: { 
    type: String, 
    enum: ['Inscrit', 'Réinscrit', 'Nouveau', 'Démission', 'Exclu'],
    default: 'Nouveau'
  },
  photo: { type: String },
  nationalite: { type: String, default: 'Sénégalaise' }
}, { timestamps: true });

// Générer un matricule selon le format: SN + année + lettre unique + chiffre
eleveSchema.pre('validate', async function(next) {
  if (!this.matricule) {
    const annee = new Date().getFullYear().toString().slice(-2); // Deux derniers chiffres
    const initiale = this.nom.charAt(0).toUpperCase(); // Première lettre du nom
    
    // Compter le nombre d'élèves avec la même initiale cette année
    const count = await mongoose.models.Eleve.countDocuments({
      matricule: { $regex: `^SN${annee}${initiale}` }
    });
    
    // Format: SN + année + initiale + numéro séquentiel (001, 002, ...)
    const numero = (count + 1).toString().padStart(3, '0');
    this.matricule = `SN${annee}${initiale}${numero}`;
  }
  next();
});

module.exports = mongoose.model('Eleve', eleveSchema);
