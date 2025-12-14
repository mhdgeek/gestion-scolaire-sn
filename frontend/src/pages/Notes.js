import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Notes = () => {
  const [showForm, setShowForm] = useState(false);
  const [showBulletin, setShowBulletin] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedEleve, setSelectedEleve] = useState('');
  const [selectedTrimestre, setSelectedTrimestre] = useState('1');
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [selectedTypeNote, setSelectedTypeNote] = useState('Devoir1');
  const [bulletinData, setBulletinData] = useState(null);
  const [verificationData, setVerificationData] = useState({});
  
  const queryClient = useQueryClient();

  // Form data
  const [formData, setFormData] = useState({
    eleve: '',
    matiere: 'Mathématiques',
    typeNote: 'Devoir1',
    note: '',
    coefficient: 1,
    trimestre: '1',
    remarque: ''
  });

  // Fetch classes for dropdown
  const { data: classes } = useQuery('classes-for-notes', async () => {
    const response = await axios.get('http://localhost:5000/api/classes');
    return response.data;
  });

  // Fetch élèves based on selected class
  const { data: eleves } = useQuery(
    ['eleves-for-notes', selectedClasse],
    async () => {
      if (!selectedClasse) return [];
      const response = await axios.get('http://localhost:5000/api/eleves', {
        params: { classe: selectedClasse }
      });
      return response.data;
    },
    { enabled: !!selectedClasse }
  );

  // Fetch notes with filters
  const { data: notes, isLoading, refetch } = useQuery(
    ['notes', selectedClasse, selectedTrimestre],
    async () => {
      const params = {};
      if (selectedClasse) params.classe = selectedClasse;
      if (selectedTrimestre) params.trimestre = selectedTrimestre;
      
      const response = await axios.get('http://localhost:5000/api/notes', { params });
      return response.data;
    },
    { enabled: !!selectedClasse }
  );

  // Fetch moyennes et classement
  const { data: moyennesData, isLoading: moyennesLoading } = useQuery(
    ['moyennes', selectedClasse, selectedTrimestre],
    async () => {
      if (!selectedClasse) return { moyennes: [], stats: {} };
      try {
        const response = await axios.get(
          `http://localhost:5000/api/notes/moyennes/classe/${selectedClasse}/${selectedTrimestre}`
        );
        return response.data;
      } catch (error) {
        console.error('Erreur lors du chargement des moyennes:', error);
        return { moyennes: [], stats: {} };
      }
    },
    { enabled: !!selectedClasse }
  );

  // Vérifier les notes d'une matière pour un élève
  const verifierNotes = async (eleveId, matiere) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/notes/verification/${eleveId}/${matiere}/${selectedTrimestre}`
      );
      setVerificationData(prev => ({
        ...prev,
        [`${eleveId}_${matiere}`]: response.data
      }));
    } catch (error) {
      console.error('Erreur de vérification:', error);
    }
  };

  // Create note
  const mutation = useMutation(
    async (data) => {
      return axios.post('http://localhost:5000/api/notes', {
        ...data,
        anneeScolaire: '2023-2024'
      });
    },
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('notes');
        queryClient.invalidateQueries('moyennes');
        toast.success('Note enregistrée !');
        resetForm();
        
        // Vérifier les notes après ajout
        if (selectedEleve && selectedMatiere) {
          verifierNotes(selectedEleve, selectedMatiere);
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur');
      }
    }
  );

  // Update note
  const updateMutation = useMutation(
    async ({ id, data }) => {
      return axios.put(`http://localhost:5000/api/notes/${id}`, data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notes');
        queryClient.invalidateQueries('moyennes');
        toast.success('Note mise à jour !');
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur');
      }
    }
  );

  // Delete note
  const deleteMutation = useMutation(
    async (id) => {
      return axios.delete(`http://localhost:5000/api/notes/${id}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notes');
        queryClient.invalidateQueries('moyennes');
        toast.success('Note supprimée !');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur de suppression');
      }
    }
  );

  const matieres = [
    'Mathématiques', 'Français', 'Anglais', 'Histoire-Géo',
    'Sciences', 'Physique-Chimie', 'SVT', 'Philosophie',
    'Informatique', 'EPS', 'Arts', 'Arabe', 'Wolof',
    'Éducation Civique', 'Technologie', 'Espagnol'
  ];

  const typeNotes = [
    { value: 'Devoir1', label: 'Devoir 1' },
    { value: 'Devoir2', label: 'Devoir 2' },
    { value: 'Composition', label: 'Composition' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      eleve: '',
      matiere: 'Mathématiques',
      typeNote: 'Devoir1',
      note: '',
      coefficient: 1,
      trimestre: selectedTrimestre,
      remarque: ''
    });
    setSelectedEleve('');
    setSelectedMatiere('');
    setSelectedTypeNote('Devoir1');
    setShowForm(false);
  };

  const handleEdit = (note) => {
    setFormData({
      eleve: note.eleve._id,
      matiere: note.matiere,
      typeNote: note.typeNote,
      note: note.note,
      coefficient: note.coefficient,
      trimestre: note.trimestre.toString(),
      remarque: note.remarque || ''
    });
    setSelectedEleve(note.eleve._id);
    setSelectedMatiere(note.matiere);
    setSelectedTypeNote(note.typeNote);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleGenerateBulletin = async (eleveId) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/notes/bulletin/${eleveId}/${selectedTrimestre}`
      );
      setBulletinData(response.data);
      setShowBulletin(true);
    } catch (error) {
      toast.error('Erreur lors de la génération du bulletin');
    }
  };

  const getNoteColor = (note) => {
    if (note >= 16) return 'text-green-600';
    if (note >= 14) return 'text-blue-600';
    if (note >= 12) return 'text-indigo-600';
    if (note >= 10) return 'text-yellow-600';
    if (note >= 8) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRangClass = (rang) => {
    if (rang === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rang === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (rang === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-50 text-blue-800 border-blue-200';
  };

  const printBulletin = () => {
    window.print();
  };

  // Vérifier les notes quand élève ou matière change
  useEffect(() => {
    if (selectedEleve && selectedMatiere) {
      verifierNotes(selectedEleve, selectedMatiere);
    }
  }, [selectedEleve, selectedMatiere, selectedTrimestre]);

  if (isLoading || moyennesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Modal Bulletin */}
      {showBulletin && bulletinData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 print:p-0">
              <div className="flex justify-between items-center mb-6 print:hidden">
                <h2 className="text-2xl font-bold text-gray-800">Bulletin Scolaire - Modèle Sénégal</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={printBulletin}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                  >
                    Imprimer
                  </button>
                  <button
                    onClick={() => setShowBulletin(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                  >
                    Fermer
                  </button>
                </div>
              </div>
              
              {/* Contenu du bulletin */}
              <div className="border-2 border-gray-800 p-6 print:p-8">
                {/* En-tête */}
                <div className="text-center mb-8 border-b pb-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className="text-left mr-8">
                      <div className="text-xl font-bold">REPUBLIQUE DU SENEGAL</div>
                      <div className="text-lg">Un Peuple - Un But - Une Foi</div>
                    </div>
                    <div className="text-center mx-8">
                      <div className="text-2xl font-bold">MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
                      <div className="text-xl font-bold text-green-700">BULLETIN DE NOTES</div>
                    </div>
                    <div className="text-right ml-8">
                      <div className="text-lg">Année Scolaire: {bulletinData.anneeScolaire}</div>
                      <div className="text-lg">Trimestre: {bulletinData.trimestre}</div>
                    </div>
                  </div>
                </div>
                
                {/* Informations élève */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">INFORMATIONS DE L'ÉLÈVE</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="font-bold mb-1">Nom et Prénom:</div>
                      <div className="border-b border-gray-300 pb-1 font-medium">
                        {bulletinData.eleve.nom} {bulletinData.eleve.prenom}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Matricule:</div>
                      <div className="border-b border-gray-300 pb-1 font-medium">
                        {bulletinData.eleve.matricule}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Classe:</div>
                      <div className="border-b border-gray-300 pb-1 font-medium">
                        {bulletinData.eleve.classe?.nom} ({bulletinData.eleve.classe?.niveau})
                      </div>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Date de naissance:</div>
                      <div className="border-b border-gray-300 pb-1">
                        {new Date(bulletinData.eleve.dateNaissance).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Sexe:</div>
                      <div className="border-b border-gray-300 pb-1">
                        {bulletinData.eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Date d'édition:</div>
                      <div className="border-b border-gray-300 pb-1">
                        {new Date(bulletinData.dateGeneration).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes détaillées */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">RÉSULTATS DÉTAILLÉS</h3>
                  <table className="w-full border-collapse border border-gray-800">
                    <thead>
                      <tr className="bg-green-800 text-white">
                        <th className="border border-gray-800 p-3 text-left">MATIÈRES</th>
                        <th className="border border-gray-800 p-3 text-center">COEFF</th>
                        <th className="border border-gray-800 p-3 text-center">DEVOIR 1</th>
                        <th className="border border-gray-800 p-3 text-center">DEVOIR 2</th>
                        <th className="border border-gray-800 p-3 text-center">COMPOSITION</th>
                        <th className="border border-gray-800 p-3 text-center">MOYENNE</th>
                        <th className="border border-gray-800 p-3 text-center">OBSERVATIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulletinData.moyennesMatieres?.map((matiere, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="border border-gray-800 p-3 font-medium">{matiere.matiere}</td>
                          <td className="border border-gray-800 p-3 text-center font-bold">{matiere.coefficient}</td>
                          <td className="border border-gray-800 p-3 text-center">{matiere.details.devoir1}/20</td>
                          <td className="border border-gray-800 p-3 text-center">{matiere.details.devoir2}/20</td>
                          <td className="border border-gray-800 p-3 text-center">{matiere.details.composition}/20</td>
                          <td className="border border-gray-800 p-3 text-center font-bold">
                            <span className={getNoteColor(matiere.moyenne)}>
                              {matiere.moyenne?.toFixed(2) || 'N/A'}/20
                            </span>
                          </td>
                          <td className="border border-gray-800 p-3 text-center">
                            {matiere.moyenne >= 10 ? 'Admis' : 'Non Admis'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Résultats généraux */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">RÉSULTATS GÉNÉRAUX</h3>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="text-center">
                      <div className="font-bold text-lg mb-2">MOYENNE GÉNÉRALE</div>
                      <div className="text-5xl font-bold py-6 border-4 border-gray-800 rounded-lg">
                        {bulletinData.moyenneGenerale ? bulletinData.moyenneGenerale.toFixed(2) : 'N/A'}/20
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg mb-2">MENTION</div>
                      <div className={`text-3xl font-bold py-6 rounded-lg ${
                        bulletinData.moyenneGenerale >= 16 ? 'bg-green-100 text-green-800 border-green-300' :
                        bulletinData.moyenneGenerale >= 14 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        bulletinData.moyenneGenerale >= 12 ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                        bulletinData.moyenneGenerale >= 10 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {bulletinData.mention || 'Non évalué'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg mb-2">APPRÉCIATION</div>
                      <div className="text-2xl font-bold py-6 border-2 border-gray-800 rounded-lg">
                        {bulletinData.appreciationGenerale || 'Non évalué'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="font-bold mb-1">Total des coefficients: {bulletinData.totalCoefficients || 0}</div>
                    <div className="text-sm text-gray-600">
                      *Note: Moyenne calculée selon le système sénégalais: (D1 + D2 + 2×Comp) / 4
                    </div>
                  </div>
                </div>
                
                {/* Décision du conseil */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">DÉCISION DU CONSEIL DE CLASSE</h3>
                  <div className="border-2 border-gray-800 p-4">
                    <div className="font-bold mb-2">
                      {bulletinData.moyenneGenerale && bulletinData.moyenneGenerale >= 10 ? 
                        'ADMIS(E) EN CLASSE SUPÉRIEURE' : 
                        'REDOUBLE LA CLASSE'}
                    </div>
                    <div className="text-gray-600 text-sm">
                      Décision prise lors du conseil de classe du {new Date().toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                
                {/* Signatures */}
                <div className="mt-12">
                  <div className="flex justify-between">
                    <div className="text-center w-1/3">
                      <div className="border-t border-gray-800 pt-2 mt-16 mx-auto w-48">
                        Le Professeur Principal
                      </div>
                    </div>
                    <div className="text-center w-1/3">
                      <div className="border-t border-gray-800 pt-2 mt-16 mx-auto w-48">
                        Le Directeur de l'Établissement
                      </div>
                    </div>
                    <div className="text-center w-1/3">
                      <div className="border-t border-gray-800 pt-2 mt-16 mx-auto w-48">
                        Le Responsable Légal
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-8 text-sm text-gray-500">
                    Cachet de l'établissement
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestion des Notes - Système Sénégalais</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {showForm ? 'Annuler' : '+ Nouvelle Note'}
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classe
            </label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner une classe</option>
              {classes?.map(classe => (
                <option key={classe._id} value={classe._id}>
                  {classe.nom} ({classe.niveau})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trimestre
            </label>
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1">1er Trimestre</option>
              <option value="2">2ème Trimestre</option>
              <option value="3">3ème Trimestre</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Matière
            </label>
            <select
              value={selectedMatiere}
              onChange={(e) => setSelectedMatiere(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Toutes les matières</option>
              {matieres.map(matiere => (
                <option key={matiere} value={matiere}>{matiere}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Nouvelle Note</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classe *
                </label>
                <select
                  required
                  value={selectedClasse}
                  onChange={(e) => setSelectedClasse(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner une classe</option>
                  {classes?.map(classe => (
                    <option key={classe._id} value={classe._id}>
                      {classe.nom} ({classe.niveau})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Élève *
                </label>
                <select
                  required
                  value={selectedEleve}
                  onChange={(e) => {
                    setSelectedEleve(e.target.value);
                    setFormData({...formData, eleve: e.target.value});
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!selectedClasse}
                >
                  <option value="">Sélectionner un élève</option>
                  {eleves?.map(eleve => (
                    <option key={eleve._id} value={eleve._id}>
                      {eleve.matricule} - {eleve.nom} {eleve.prenom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matière *
                </label>
                <select
                  required
                  value={selectedMatiere}
                  onChange={(e) => {
                    setSelectedMatiere(e.target.value);
                    setFormData({...formData, matiere: e.target.value});
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner une matière</option>
                  {matieres.map(matiere => (
                    <option key={matiere} value={matiere}>{matiere}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de note *
                </label>
                <select
                  required
                  value={selectedTypeNote}
                  onChange={(e) => {
                    setSelectedTypeNote(e.target.value);
                    setFormData({...formData, typeNote: e.target.value});
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {typeNotes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note /20 *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="20"
                  step="0.25"
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coefficient *
                </label>
                <select
                  required
                  value={formData.coefficient}
                  onChange={(e) => setFormData({...formData, coefficient: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarque
                </label>
                <textarea
                  value={formData.remarque}
                  onChange={(e) => setFormData({...formData, remarque: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="2"
                />
              </div>
            </div>

            {/* Vérification des notes */}
            {selectedEleve && selectedMatiere && verificationData[`${selectedEleve}_${selectedMatiere}`] && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">État des notes pour cette matière:</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="font-bold">Devoir 1</div>
                    <div className={`text-lg font-bold ${verificationData[`${selectedEleve}_${selectedMatiere}`].notes.devoir1 ? 'text-green-600' : 'text-red-600'}`}>
                      {verificationData[`${selectedEleve}_${selectedMatiere}`].notes.devoir1 || 'Non noté'}/20
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Devoir 2</div>
                    <div className={`text-lg font-bold ${verificationData[`${selectedEleve}_${selectedMatiere}`].notes.devoir2 ? 'text-green-600' : 'text-red-600'}`}>
                      {verificationData[`${selectedEleve}_${selectedMatiere}`].notes.devoir2 || 'Non noté'}/20
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Composition</div>
                    <div className={`text-lg font-bold ${verificationData[`${selectedEleve}_${selectedMatiere}`].notes.composition ? 'text-green-600' : 'text-red-600'}`}>
                      {verificationData[`${selectedEleve}_${selectedMatiere}`].notes.composition || 'Non noté'}/20
                    </div>
                  </div>
                </div>
                {verificationData[`${selectedEleve}_${selectedMatiere}`].complet && (
                  <div className="mt-2 text-center">
                    <div className="font-bold text-green-700">
                      Matière complète! Moyenne: {verificationData[`${selectedEleve}_${selectedMatiere}`].moyenne}/20
                    </div>
                    <div className="text-sm text-gray-600">
                      Formule: (D1 + D2 + 2×Comp) / 4
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={mutation.isLoading || !selectedEleve}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {mutation.isLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedClasse && moyennesData && (
        <>
          {/* Statistiques de la classe */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Moyenne classe</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {moyennesData?.stats?.moyenneClasse ? moyennesData.stats.moyenneClasse.toFixed(2) : 'N/A'}/20
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Élèves complets</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {moyennesData?.stats?.elevesComplets || 0}/{moyennesData?.stats?.totalEleves || 0}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Meilleure moyenne</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {moyennesData?.stats?.meilleureMoyenne ? moyennesData.stats.meilleureMoyenne.toFixed(2) : 'N/A'}/20
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Trimestre</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {selectedTrimestre}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Taux de réussite</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {moyennesData?.stats?.moyenneClasse ? 
                    (moyennesData.stats.moyenneClasse >= 10 ? '100%' : '0%') : 
                    'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Tableau des moyennes avec classement */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold">Classement de la classe - Système Sénégalais</h3>
              <p className="text-sm text-gray-600">Moyenne = (Devoir1 + Devoir2 + 2×Composition) / 4</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Rang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Élève
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Matricule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Moyenne Générale
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Matières complètes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Mention
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {moyennesData?.moyennes?.map((item) => (
                    <tr key={item.eleve._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {item.rang ? (
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full border ${getRangClass(item.rang)}`}>
                            {item.rang}
                          </div>
                        ) : (
                          <div className="text-gray-400">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {item.eleve.nom} {item.eleve.prenom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.eleve.sexe === 'M' ? '♂ Garçon' : '♀ Fille'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm font-bold">{item.eleve.matricule}</div>
                      </td>
                      <td className="px-6 py-4">
                        {item.moyenneGenerale ? (
                          <div className={`font-bold text-lg ${getNoteColor(item.moyenneGenerale)}`}>
                            {item.moyenneGenerale.toFixed(2)}/20
                          </div>
                        ) : (
                          <div className="text-red-600 font-medium">Notes incomplètes</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">
                          {item.moyennesMatieres?.length || 0} / {item.totalCoefficients || 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.complet ? 'Complet' : 'Incomplet'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.moyenneGenerale && (
                          <span className={`px-3 py-1 text-sm rounded-full ${
                            item.moyenneGenerale >= 16 ? 'bg-green-100 text-green-800' :
                            item.moyenneGenerale >= 14 ? 'bg-blue-100 text-blue-800' :
                            item.moyenneGenerale >= 12 ? 'bg-indigo-100 text-indigo-800' :
                            item.moyenneGenerale >= 10 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.moyenneGenerale >= 16 ? 'Excellent' :
                             item.moyenneGenerale >= 14 ? 'Très Bien' :
                             item.moyenneGenerale >= 12 ? 'Bien' :
                             item.moyenneGenerale >= 10 ? 'Assez Bien' :
                             item.moyenneGenerale >= 8 ? 'Passable' : 'Insuffisant'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleGenerateBulletin(item.eleve._id)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                          disabled={!item.moyenneGenerale}
                        >
                          {item.moyenneGenerale ? 'Bulletin' : 'Notes incomplètes'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liste des notes détaillées */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Notes détaillées par élève</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Élève
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Matière
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Note
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coefficient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trimestre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {notes
                    ?.filter(note => !selectedMatiere || note.matiere === selectedMatiere)
                    .map((note) => (
                    <tr key={note._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {note.eleve.nom} {note.eleve.prenom}
                        </div>
                        <div className="text-sm text-gray-500">{note.eleve.matricule}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{note.matiere}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          note.typeNote === 'Devoir1' ? 'bg-blue-100 text-blue-800' :
                          note.typeNote === 'Devoir2' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {note.typeNote === 'Devoir1' ? 'Devoir 1' :
                           note.typeNote === 'Devoir2' ? 'Devoir 2' : 'Composition'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-bold ${getNoteColor(note.note)}`}>
                          {note.note}/20
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{note.coefficient}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{note.trimestre}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(note)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(note._id)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedClasse && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sélectionnez une classe</h3>
          <p className="text-gray-600">Veuillez sélectionner une classe pour afficher et gérer les notes selon le système sénégalais.</p>
        </div>
      )}
    </div>
  );
};

export default Notes;
