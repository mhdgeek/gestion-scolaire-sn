const express = require('express');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

// Fonction pour générer un matricule selon le format Sénégalais
const generateMatricule = async (nom, prenom) => {
  const annee = new Date().getFullYear().toString().slice(-2);
  const initiale = nom.charAt(0).toUpperCase();
  
  // Compter le nombre d'élèves avec la même initiale cette année
  const count = await Eleve.countDocuments({
    matricule: { $regex: `^SN${annee}${initiale}` }
  });
  
  // Format: SN + année + initiale + numéro séquentiel (001, 002, ...)
  const numero = (count + 1).toString().padStart(3, '0');
  return `SN${annee}${initiale}${numero}`;
};

// Template CSV/Excel avec le bon format de matricule
router.get('/template', auth, (req, res) => {
  const template = [
    {
      'Matricule': 'SN24D001',
      'Nom': 'DIOP',
      'Prénom': 'Moussa',
      'Date Naissance': '2010-05-15',
      'Lieu Naissance': 'Dakar',
      'Sexe': 'M',
      'Adresse': 'Point E, Dakar',
      'Téléphone': '781234567',
      'Email': 'moussa.diop@email.com',
      'Classe': '6ème A',
      'Niveau': '6ème',
      'Nom Père': 'Mamadou DIOP',
      'Profession Père': 'Enseignant',
      'Nom Mère': 'Aminata DIOP',
      'Profession Mère': 'Commerçante',
      'Téléphone Parent': '771234567',
      'Situation': 'Nouveau',
      'Nationalité': 'Sénégalaise'
    },
    {
      'Matricule': 'SN24D002',
      'Nom': 'DIOP',
      'Prénom': 'Fatou',
      'Date Naissance': '2011-08-20',
      'Lieu Naissance': 'Thiès',
      'Sexe': 'F',
      'Adresse': 'Thiès Centre',
      'Téléphone': '781234568',
      'Email': 'fatou.diop@email.com',
      'Classe': '5ème B',
      'Niveau': '5ème',
      'Nom Père': 'Ibrahima DIOP',
      'Profession Père': 'Médecin',
      'Nom Mère': 'Aïssatou DIOP',
      'Profession Mère': 'Infirmière',
      'Téléphone Parent': '771234568',
      'Situation': 'Nouveau',
      'Nationalité': 'Sénégalaise'
    }
  ];

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(template);
  
  // Mettre en forme les colonnes
  const colWidths = [
    { wch: 10 }, // Matricule
    { wch: 15 }, // Nom
    { wch: 15 }, // Prénom
    { wch: 12 }, // Date Naissance
    { wch: 15 }, // Lieu Naissance
    { wch: 5 },  // Sexe
    { wch: 20 }, // Adresse
    { wch: 12 }, // Téléphone
    { wch: 20 }, // Email
    { wch: 10 }, // Classe
    { wch: 8 },  // Niveau
    { wch: 15 }, // Nom Père
    { wch: 15 }, // Profession Père
    { wch: 15 }, // Nom Mère
    { wch: 15 }, // Profession Mère
    { wch: 12 }, // Téléphone Parent
    { wch: 10 }, // Situation
    { wch: 12 }  // Nationalité
  ];
  
  worksheet['!cols'] = colWidths;

  xlsx.utils.book_append_sheet(workbook, worksheet, 'Élèves');
  
  // Ajouter une feuille d'instructions
  const instructions = [
    ['INSTRUCTIONS POUR L\'IMPORTATION'],
    [''],
    ['FORMAT DU MATRICULE: SN + ANNEE + LETTRE + NUMERO'],
    ['Exemple: SN24D001 = SN (Sénégal) + 24 (2024) + D (DIOP) + 001 (numéro)'],
    [''],
    ['CHAMPS OBLIGATOIRES: Nom, Prénom, Classe, Niveau, Nom Père, Nom Mère, Téléphone Parent'],
    [''],
    ['FORMAT DES DATES: AAAA-MM-JJ (ex: 2010-05-15)'],
    [''],
    ['SEXE: M (Masculin) ou F (Féminin)'],
    [''],
    ['NIVEAUX AUTORISÉS: CI, CP, CE1, CE2, CM1, CM2, 6ème, 5ème, 4ème, 3ème, 2nd, 1ère, Tle'],
    [''],
    ['SITUATIONS: Nouveau, Inscrit, Réinscrit, Démission, Exclu']
  ];
  
  const instructionSheet = xlsx.utils.aoa_to_sheet(instructions);
  xlsx.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=template_import_eleves_senegal.xlsx');
  res.send(buffer);
});

// Télécharger le template CSV
router.get('/template-csv', auth, (req, res) => {
  const csvContent = [
    'Matricule,Nom,Prénom,Date Naissance,Lieu Naissance,Sexe,Adresse,Téléphone,Email,Classe,Niveau,Nom Père,Profession Père,Nom Mère,Profession Mère,Téléphone Parent,Situation,Nationalité',
    'SN24D001,DIOP,Moussa,2010-05-15,Dakar,M,Point E Dakar,781234567,moussa.diop@email.com,6ème A,6ème,Mamadou DIOP,Enseignant,Aminata DIOP,Commerçante,771234567,Nouveau,Sénégalaise',
    'SN24S002,SARR,Fatou,2011-03-22,Thiès,F,Thiès Centre,781234568,fatou.sarr@email.com,5ème B,5ème,Moustapha SARR,Ingénieur,Khadidiatou SARR,Enseignante,771234568,Nouveau,Sénégalaise'
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=template_import_eleves_senegal.csv');
  res.send(csvContent);
});

// Upload et importation de fichier
router.post('/eleves', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Veuillez sélectionner un fichier' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    let elevesData = [];

    // Lire le fichier selon son type
    if (fileExt === '.csv') {
      elevesData = await readCSVFile(filePath);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      elevesData = await readExcelFile(filePath);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Format de fichier non supporté' });
    }

    if (elevesData.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Aucune donnée trouvée dans le fichier' });
    }

    // Valider et importer les données
    const result = await importElevesData(elevesData);

    // Supprimer le fichier temporaire
    fs.unlinkSync(filePath);

    res.json({
      message: 'Importation terminée',
      result: result
    });

  } catch (error) {
    // Nettoyer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de l\'importation',
      error: error.message 
    });
  }
});

// Fonction pour lire un fichier CSV
async function readCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Nettoyer les données
        const cleanedData = {};
        Object.keys(data).forEach(key => {
          const cleanKey = key.trim();
          cleanedData[cleanKey] = data[key] ? data[key].trim() : '';
        });
        results.push(cleanedData);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Fonction pour lire un fichier Excel
async function readExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
  
  // Nettoyer les données
  return data.map(row => {
    const cleanedRow = {};
    Object.keys(row).forEach(key => {
      const cleanKey = key.trim();
      const value = row[key];
      cleanedRow[cleanKey] = typeof value === 'string' ? value.trim() : value;
    });
    return cleanedRow;
  });
}

// Importer les données des élèves
async function importElevesData(elevesData) {
  const results = {
    total: elevesData.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    matricules: []
  };

  for (let i = 0; i < elevesData.length; i++) {
    const row = elevesData[i];
    const ligne = i + 2; // +2 pour header + index 0-based

    try {
      // Validation des champs requis
      const requiredFields = ['Nom', 'Prénom', 'Classe', 'Niveau', 'Nom Père', 'Nom Mère', 'Téléphone Parent'];
      const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
      
      if (missingFields.length > 0) {
        results.skipped++;
        results.errors.push({
          ligne,
          message: `Champs manquants: ${missingFields.join(', ')}`,
          data: row
        });
        continue;
      }

      // Valider le format du matricule s'il est fourni
      let matricule = row['Matricule'] ? row['Matricule'].trim() : null;
      
      if (matricule) {
        // Vérifier le format du matricule: SN + année + lettre + chiffres
        const matriculeRegex = /^SN\d{2}[A-Z]\d{3}$/;
        if (!matriculeRegex.test(matricule)) {
          results.skipped++;
          results.errors.push({
            ligne,
            message: `Format de matricule invalide. Doit être: SN + année + lettre + 3 chiffres (ex: SN24D001)`,
            data: row
          });
          continue;
        }
        
        // Vérifier si le matricule existe déjà
        const matriculeExiste = await Eleve.findOne({ matricule });
        if (matriculeExiste) {
          results.skipped++;
          results.errors.push({
            ligne,
            message: `Matricule déjà utilisé: ${matricule}`,
            data: row
          });
          continue;
        }
      } else {
        // Générer un matricule selon le format sénégalais
        matricule = await generateMatricule(row['Nom'].trim(), row['Prénom'].trim());
      }

      // Chercher ou créer la classe
      let classe = await Classe.findOne({ 
        nom: row['Classe'].trim(),
        niveau: row['Niveau'].trim()
      });

      if (!classe) {
        // Créer une nouvelle classe si elle n'existe pas
        classe = new Classe({
          nom: row['Classe'].trim(),
          niveau: row['Niveau'].trim(),
          professeurPrincipal: 'À définir',
          capaciteMax: 40,
          anneeScolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
        });
        await classe.save();
      }

      // Vérifier si l'élève existe déjà (par nom, prénom et classe)
      let eleve = await Eleve.findOne({
        nom: row['Nom'].trim(),
        prenom: row['Prénom'].trim(),
        classe: classe._id
      });

      // Préparer les données
      const eleveData = {
        matricule: matricule,
        nom: row['Nom'].trim(),
        prenom: row['Prénom'].trim(),
        dateNaissance: row['Date Naissance'] ? new Date(row['Date Naissance']) : new Date('2000-01-01'),
        lieuNaissance: row['Lieu Naissance'] ? row['Lieu Naissance'].trim() : 'Non spécifié',
        sexe: row['Sexe'] ? row['Sexe'].trim().toUpperCase() : 'M',
        adresse: row['Adresse'] ? row['Adresse'].trim() : 'Non spécifiée',
        telephone: row['Téléphone'] ? row['Téléphone'].trim() : '',
        email: row['Email'] ? row['Email'].trim() : '',
        classe: classe._id,
        nomPere: row['Nom Père'].trim(),
        professionPere: row['Profession Père'] ? row['Profession Père'].trim() : '',
        nomMere: row['Nom Mère'].trim(),
        professionMere: row['Profession Mère'] ? row['Profession Mère'].trim() : '',
        telephoneParent: row['Téléphone Parent'].trim(),
        situation: row['Situation'] ? row['Situation'].trim() : 'Nouveau',
        nationalite: row['Nationalité'] ? row['Nationalité'].trim() : 'Sénégalaise',
        dateInscription: new Date()
      };

      if (eleve) {
        // Mettre à jour l'élève existant
        await Eleve.findByIdAndUpdate(eleve._id, eleveData);
        results.updated++;
        results.matricules.push({ old: eleve.matricule, new: matricule, action: 'updated' });
      } else {
        // Créer un nouvel élève
        eleve = new Eleve(eleveData);
        await eleve.save();
        results.imported++;
        results.matricules.push({ matricule: matricule, action: 'created' });
        
        // Mettre à jour l'effectif de la classe
        await classe.updateEffectif();
      }

    } catch (error) {
      results.skipped++;
      results.errors.push({
        ligne,
        message: error.message,
        data: row
      });
    }
  }

  return results;
}

// Vérification des données avant import
router.post('/preview', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Veuillez sélectionner un fichier' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    let elevesData = [];

    if (fileExt === '.csv') {
      elevesData = await readCSVFile(filePath);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      elevesData = await readExcelFile(filePath);
    }

    // Nettoyer le fichier temporaire
    fs.unlinkSync(filePath);

    // Analyser les données
    const analysis = {
      totalRows: elevesData.length,
      sampleData: elevesData.slice(0, 5), // Afficher les 5 premières lignes
      headers: elevesData.length > 0 ? Object.keys(elevesData[0]) : [],
      validation: validateData(elevesData),
      matriculesProposes: []
    };

    // Proposer des matricules pour les lignes sans matricule
    for (let i = 0; i < Math.min(elevesData.length, 5); i++) {
      const row = elevesData[i];
      if (row['Nom']) {
        const matriculePropose = await generateMatricule(row['Nom'].trim(), row['Prénom']?.trim() || '');
        analysis.matriculesProposes.push({
          ligne: i + 2,
          nom: row['Nom'],
          prenom: row['Prénom'],
          matriculePropose: matriculePropose
        });
      }
    }

    res.json(analysis);

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de l\'analyse du fichier',
      error: error.message 
    });
  }
});

// Valider les données
function validateData(data) {
  const validation = {
    valid: true,
    errors: [],
    stats: {
      avecMatricule: 0,
      sansMatricule: 0,
      matriculesValides: 0,
      matriculesInvalides: 0,
      classesUniques: new Set(),
      niveauxUniques: new Set(),
      initialesUniques: new Set()
    }
  };

  data.forEach((row, index) => {
    const ligne = index + 2;
    
    // Vérifier les champs requis
    const requiredFields = ['Nom', 'Prénom', 'Classe', 'Niveau', 'Nom Père', 'Nom Mère', 'Téléphone Parent'];
    requiredFields.forEach(field => {
      if (!row[field] || row[field].toString().trim() === '') {
        validation.errors.push({
          ligne,
          champ: field,
          message: 'Champ requis manquant'
        });
        validation.valid = false;
      }
    });

    // Statistiques matricule
    if (row['Matricule'] && row['Matricule'].toString().trim() !== '') {
      validation.stats.avecMatricule++;
      
      // Vérifier le format du matricule
      const matricule = row['Matricule'].toString().trim();
      const matriculeRegex = /^SN\d{2}[A-Z]\d{3}$/;
      if (matriculeRegex.test(matricule)) {
        validation.stats.matriculesValides++;
      } else {
        validation.stats.matriculesInvalides++;
        validation.errors.push({
          ligne,
          champ: 'Matricule',
          message: `Format invalide. Doit être: SN + année + lettre + 3 chiffres (ex: SN24D001)`
        });
        validation.valid = false;
      }
    } else {
      validation.stats.sansMatricule++;
    }

    if (row['Classe']) {
      validation.stats.classesUniques.add(row['Classe'].toString().trim());
    }

    if (row['Niveau']) {
      validation.stats.niveauxUniques.add(row['Niveau'].toString().trim());
    }

    if (row['Nom']) {
      const initiale = row['Nom'].toString().trim().charAt(0).toUpperCase();
      validation.stats.initialesUniques.add(initiale);
    }

    // Valider le format de la date
    if (row['Date Naissance']) {
      const date = new Date(row['Date Naissance']);
      if (isNaN(date.getTime())) {
        validation.errors.push({
          ligne,
          champ: 'Date Naissance',
          message: 'Format de date invalide. Utilisez AAAA-MM-JJ'
        });
        validation.valid = false;
      }
    }

    // Valider le sexe
    if (row['Sexe']) {
      const sexe = row['Sexe'].toString().trim().toUpperCase();
      if (!['M', 'F'].includes(sexe)) {
        validation.errors.push({
          ligne,
          champ: 'Sexe',
          message: 'Le sexe doit être M ou F'
        });
        validation.valid = false;
      }
    }

    // Valider le niveau scolaire
    if (row['Niveau']) {
      const niveauxValides = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nd', '1ère', 'Tle'];
      const niveau = row['Niveau'].toString().trim();
      if (!niveauxValides.includes(niveau)) {
        validation.errors.push({
          ligne,
          champ: 'Niveau',
          message: `Niveau invalide. Choisissez parmi: ${niveauxValides.join(', ')}`
        });
        validation.valid = false;
      }
    }
  });

  // Convertir les Sets en Arrays
  validation.stats.classesUniques = Array.from(validation.stats.classesUniques);
  validation.stats.niveauxUniques = Array.from(validation.stats.niveauxUniques);
  validation.stats.initialesUniques = Array.from(validation.stats.initialesUniques);

  return validation;
}

module.exports = router;
