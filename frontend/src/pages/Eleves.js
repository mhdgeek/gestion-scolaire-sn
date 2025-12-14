import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Eleves = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [generatedMatricule, setGeneratedMatricule] = useState('');
  
  const queryClient = useQueryClient();

  // Form data
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    lieuNaissance: '',
    sexe: 'M',
    adresse: '',
    telephone: '',
    email: '',
    classe: '',
    nomPere: '',
    professionPere: '',
    nomMere: '',
    professionMere: '',
    telephoneParent: '',
    situation: 'Nouveau',
    nationalite: 'Sénégalaise'
  });

  // Fetch classes for dropdown
  const { data: classes, isLoading: classesLoading } = useQuery('classes-for-eleves', async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/classes');
      return response.data;
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
      return [];
    }
  });

  // Fetch élèves with filters
  const { 
    data: eleves, 
    isLoading: elevesLoading, 
    error: elevesError,
    refetch: refetchEleves 
  } = useQuery(
    ['eleves', selectedClasse, searchTerm],
    async () => {
      try {
        const params = {};
        if (selectedClasse) params.classe = selectedClasse;
        if (searchTerm) params.search = searchTerm;
        
        const response = await axios.get('http://localhost:5000/api/eleves', { params });
        console.log('Élèves chargés:', response.data);
        return response.data;
      } catch (error) {
        console.error('Erreur lors du chargement des élèves:', error);
        toast.error('Erreur lors du chargement des élèves');
        return [];
      }
    }
  );

  // Generate matricule function
 // Generate matricule function according to Senegalese format
  const generateMatricule = () => {
    const annee = new Date().getFullYear().toString().slice(-2); // Last 2 digits of year
    const initiale = formData.nom.charAt(0).toUpperCase(); // First letter of last name
    
    // For demo, we'll use a random number. In production, this would come from the backend
    const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999
    const matricule = `SN${annee}${initiale}${randomNum}`;
    setGeneratedMatricule(matricule);
    return matricule;
  };

  // Create/Update élève
  const mutation = useMutation(
    async (data) => {
      if (editingId) {
        return axios.put(`http://localhost:5000/api/eleves/${editingId}`, data);
      } else {
        // Ajouter le matricule généré
        const eleveData = {
          ...data,
          matricule: generatedMatricule
        };
        return axios.post('http://localhost:5000/api/eleves', eleveData);
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('eleves');
        toast.success(editingId ? 'Élève mis à jour !' : 'Élève créé !');
        resetForm();
        refetchEleves();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Erreur lors de l\'enregistrement';
        toast.error(errorMessage);
        console.error('Erreur mutation:', error);
      }
    }
  );

  // Delete élève
  const deleteMutation = useMutation(
    async (id) => {
      return axios.delete(`http://localhost:5000/api/eleves/${id}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('eleves');
        toast.success('Élève supprimé !');
        refetchEleves();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur de suppression');
      }
    }
  );

  const situations = ['Nouveau', 'Inscrit', 'Réinscrit', 'Démission', 'Exclu'];
  const nationalites = ['Sénégalaise', 'Malienne', 'Mauritanienne', 'Guinéenne', 'Autre'];

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      dateNaissance: '',
      lieuNaissance: '',
      sexe: 'M',
      adresse: '',
      telephone: '',
      email: '',
      classe: '',
      nomPere: '',
      professionPere: '',
      nomMere: '',
      professionMere: '',
      telephoneParent: '',
      situation: 'Nouveau',
      nationalite: 'Sénégalaise'
    });
    setGeneratedMatricule('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (eleve) => {
    setFormData({
      nom: eleve.nom,
      prenom: eleve.prenom,
      dateNaissance: eleve.dateNaissance ? eleve.dateNaissance.split('T')[0] : '',
      lieuNaissance: eleve.lieuNaissance,
      sexe: eleve.sexe,
      adresse: eleve.adresse,
      telephone: eleve.telephone || '',
      email: eleve.email || '',
      classe: eleve.classe?._id || eleve.classe,
      nomPere: eleve.nomPere,
      professionPere: eleve.professionPere || '',
      nomMere: eleve.nomMere,
      professionMere: eleve.professionMere || '',
      telephoneParent: eleve.telephoneParent,
      situation: eleve.situation,
      nationalite: eleve.nationalite || 'Sénégalaise'
    });
    setGeneratedMatricule(eleve.matricule);
    setEditingId(eleve._id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet élève ?')) {
      deleteMutation.mutate(id);
    }
  };

  const calculateAge = (dateString) => {
    if (!dateString) return 'N/A';
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Générer un matricule quand le formulaire s'ouvre pour un nouvel élève
  useEffect(() => {
    if (showForm && !editingId) {
      generateMatricule();
    }
  }, [showForm, editingId]);

  if (elevesLoading || classesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestion des Élèves</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {showForm ? 'Annuler' : '+ Nouvel Élève'}
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par classe
            </label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Toutes les classes</option>
              {classes?.map(classe => (
                <option key={classe._id} value={classe._id}>
                  {classe.nom} ({classe.niveau})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nom, prénom ou matricule"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedClasse('');
                setSearchTerm('');
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Modifier l\'Élève' : 'Nouvel Élève'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Matricule Field */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matricule
                  </label>
                  <div className="font-mono text-lg font-bold text-blue-600">
                    {generatedMatricule}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Ce matricule est généré automatiquement et sera attribué à l'élève.
                  </p>
                </div>
                {!editingId && (
                  <button
                    type="button"
                    onClick={generateMatricule}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                  >
                    Regénérer
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Informations personnelles */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-700">Informations personnelles</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.prenom}
                    onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de naissance *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dateNaissance}
                    onChange={(e) => setFormData({...formData, dateNaissance: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieu de naissance *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lieuNaissance}
                    onChange={(e) => setFormData({...formData, lieuNaissance: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sexe *
                  </label>
                  <select
                    value={formData.sexe}
                    onChange={(e) => setFormData({...formData, sexe: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
              </div>

              {/* Informations scolaires */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-700">Informations scolaires</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classe *
                  </label>
                  <select
                    required
                    value={formData.classe}
                    onChange={(e) => setFormData({...formData, classe: e.target.value})}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Situation *
                  </label>
                  <select
                    value={formData.situation}
                    onChange={(e) => setFormData({...formData, situation: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {situations.map(situation => (
                      <option key={situation} value={situation}>{situation}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nationalité
                  </label>
                  <select
                    value={formData.nationalite}
                    onChange={(e) => setFormData({...formData, nationalite: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {nationalites.map(nat => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.adresse}
                    onChange={(e) => setFormData({...formData, adresse: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Informations parents */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-700">Informations parents</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du père *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nomPere}
                    onChange={(e) => setFormData({...formData, nomPere: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profession du père
                  </label>
                  <input
                    type="text"
                    value={formData.professionPere}
                    onChange={(e) => setFormData({...formData, professionPere: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de la mère *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nomMere}
                    onChange={(e) => setFormData({...formData, nomMere: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profession de la mère
                  </label>
                  <input
                    type="text"
                    value={formData.professionMere}
                    onChange={(e) => setFormData({...formData, professionMere: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone parent *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.telephoneParent}
                    onChange={(e) => setFormData({...formData, telephoneParent: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={mutation.isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {mutation.isLoading ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Élèves</p>
            <p className="text-2xl font-semibold text-gray-900">{eleves?.length || 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Garçons</p>
            <p className="text-2xl font-semibold text-gray-900">
              {eleves?.filter(e => e.sexe === 'M').length || 0}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Filles</p>
            <p className="text-2xl font-semibold text-gray-900">
              {eleves?.filter(e => e.sexe === 'F').length || 0}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Nouveaux</p>
            <p className="text-2xl font-semibold text-gray-900">
              {eleves?.filter(e => e.situation === 'Nouveau').length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Liste des élèves */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {elevesError && (
          <div className="bg-red-50 border border-red-200 p-4">
            <p className="text-red-800">Erreur lors du chargement des élèves. Veuillez réessayer.</p>
            <button
              onClick={() => refetchEleves()}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Réessayer
            </button>
          </div>
        )}

        {eleves?.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun élève trouvé</h3>
            <p className="text-gray-600">
              {selectedClasse || searchTerm 
                ? 'Aucun élève ne correspond à vos critères de recherche.' 
                : 'Commencez par ajouter des élèves en cliquant sur "Nouvel Élève".'}
            </p>
            {!selectedClasse && !searchTerm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Ajouter un premier élève
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matricule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom & Prénom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Situation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {eleves?.map((eleve) => (
                  <tr key={eleve._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-blue-600 font-bold">{eleve.matricule}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {eleve.nom} {eleve.prenom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {eleve.sexe === 'M' ? '♂' : '♀'} • {calculateAge(eleve.dateNaissance)} ans
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{eleve.classe?.nom || 'Non assigné'}</div>
                      <div className="text-sm text-gray-500">{eleve.classe?.niveau || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">
                        {calculateAge(eleve.dateNaissance)} ans
                      </div>
                      <div className="text-sm text-gray-500">
                        {eleve.dateNaissance ? new Date(eleve.dateNaissance).toLocaleDateString('fr-FR') : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium">{eleve.nomPere}</div>
                        <div className="text-gray-500">{eleve.telephoneParent}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        eleve.situation === 'Nouveau' ? 'bg-blue-100 text-blue-800' :
                        eleve.situation === 'Inscrit' || eleve.situation === 'Réinscrit' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {eleve.situation}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(eleve)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(eleve._id)}
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
        )}
      </div>
    </div>
  );
};

export default Eleves;
