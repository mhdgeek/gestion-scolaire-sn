import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Classes = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    niveau: 'CI',
    serie: '',
    professeurPrincipal: '',
    capaciteMax: 40,
    anneeScolaire: '2023-2024'
  });
  const [editingId, setEditingId] = useState(null);
  
  const queryClient = useQueryClient();

  // Fetch classes
  const { data: classes, isLoading } = useQuery('classes', async () => {
    const response = await axios.get('http://localhost:5000/api/classes');
    return response.data;
  });

  // Create/Update class
  const mutation = useMutation(
    async (data) => {
      if (editingId) {
        return axios.put(`http://localhost:5000/api/classes/${editingId}`, data);
      } else {
        return axios.post('http://localhost:5000/api/classes', data);
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('classes');
        toast.success(editingId ? 'Classe mise à jour !' : 'Classe créée !');
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur');
      }
    }
  );

  // Delete class
  const deleteMutation = useMutation(
    async (id) => {
      return axios.delete(`http://localhost:5000/api/classes/${id}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('classes');
        toast.success('Classe supprimée !');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur de suppression');
      }
    }
  );

  const niveaux = [
    'Préscolaire', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
    '6ème', '5ème', '4ème', '3ème', '2nd', '1ère', 'Tle'
  ];

  const series = [
    { value: '', label: 'Aucune' },
    { value: 'Générale', label: 'Générale' },
    { value: 'L', label: 'Littéraire' },
    { value: 'S', label: 'Scientifique' },
    { value: 'ES', label: 'Économique et Social' },
    { value: 'Technique', label: 'Technique' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      niveau: 'CI',
      serie: '',
      professeurPrincipal: '',
      capaciteMax: 40,
      anneeScolaire: '2023-2024'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (classe) => {
    setFormData({
      nom: classe.nom,
      niveau: classe.niveau,
      serie: classe.serie || '',
      professeurPrincipal: classe.professeurPrincipal,
      capaciteMax: classe.capaciteMax,
      anneeScolaire: classe.anneeScolaire
    });
    setEditingId(classe._id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) {
      deleteMutation.mutate(id);
    }
  };

  const getEffectifColor = (effectif, capaciteMax) => {
    const ratio = effectif / capaciteMax;
    if (ratio >= 0.9) return 'text-red-600';
    if (ratio >= 0.7) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestion des Classes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {showForm ? 'Annuler' : '+ Nouvelle Classe'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Modifier la Classe' : 'Nouvelle Classe'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la classe *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({...formData, nom: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 6ème A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Niveau *
                </label>
                <select
                  value={formData.niveau}
                  onChange={(e) => setFormData({...formData, niveau: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {niveaux.map(niveau => (
                    <option key={niveau} value={niveau}>{niveau}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Série
                </label>
                <select
                  value={formData.serie}
                  onChange={(e) => setFormData({...formData, serie: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {series.map(serie => (
                    <option key={serie.value} value={serie.value}>{serie.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professeur Principal *
                </label>
                <input
                  type="text"
                  required
                  value={formData.professeurPrincipal}
                  onChange={(e) => setFormData({...formData, professeurPrincipal: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nom du professeur"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacité maximale
                </label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={formData.capaciteMax}
                  onChange={(e) => setFormData({...formData, capaciteMax: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Année scolaire
                </label>
                <input
                  type="text"
                  value={formData.anneeScolaire}
                  onChange={(e) => setFormData({...formData, anneeScolaire: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2023-2024"
                />
              </div>
            </div>

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
            <p className="text-sm font-medium text-gray-600">Total Classes</p>
            <p className="text-2xl font-semibold text-gray-900">{classes?.length || 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Élèves</p>
            <p className="text-2xl font-semibold text-gray-900">
              {classes?.reduce((sum, classe) => sum + (classe.effectif || 0), 0) || 0}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Taux de remplissage</p>
            <p className="text-2xl font-semibold text-gray-900">
              {classes?.length ? Math.round(
                classes.reduce((sum, classe) => sum + (classe.effectif || 0), 0) /
                classes.reduce((sum, classe) => sum + (classe.capaciteMax || 40), 0) * 100
              ) : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Année scolaire</p>
            <p className="text-2xl font-semibold text-gray-900">2023-2024</p>
          </div>
        </div>
      </div>

      {/* Liste des classes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Niveau/Série
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Professeur Principal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effectif
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes?.map((classe) => (
                <tr key={classe._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{classe.nom}</div>
                    <div className="text-sm text-gray-500">{classe.anneeScolaire}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{classe.niveau}</div>
                    {classe.serie && (
                      <div className="text-sm text-gray-500">{classe.serie}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{classe.professeurPrincipal}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`font-medium ${getEffectifColor(classe.effectif, classe.capaciteMax)}`}>
                      {classe.effectif || 0} / {classe.capaciteMax}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${getEffectifColor(classe.effectif, classe.capaciteMax).replace('text-', 'bg-')}`}
                        style={{ 
                          width: `${Math.min(100, ((classe.effectif || 0) / classe.capaciteMax) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(classe)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(classe._id)}
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
    </div>
  );
};

export default Classes;
