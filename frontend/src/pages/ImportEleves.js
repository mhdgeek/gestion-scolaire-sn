import React, { useState } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQueryClient } from 'react-query';

const ImportEleves = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  
  const queryClient = useQueryClient();

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error('Veuillez sélectionner un fichier CSV ou Excel');
        event.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      setImportResult(null);
      setPreviewData(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setIsPreviewing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/import/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      setPreviewData(response.data);
      setIsPreviewing(false);
      toast.success('Prévisualisation réussie');
    } catch (error) {
      toast.error('Erreur lors de la prévisualisation: ' + (error.response?.data?.message || error.message));
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/import/eleves', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      setImportResult(response.data.result);
      toast.success('Importation réussie !');
      
      queryClient.invalidateQueries('eleves');
      queryClient.invalidateQueries('classes');
      
      setIsLoading(false);
    } catch (error) {
      toast.error('Erreur lors de l\'importation: ' + (error.response?.data?.message || error.message));
      setIsLoading(false);
    }
  };

  const downloadTemplate = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = format === 'excel' 
        ? 'http://localhost:5000/api/import/template'
        : 'http://localhost:5000/api/import/template-csv';

      const response = await axios.get(endpoint, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 
        format === 'excel' ? 'template_import_eleves.xlsx' : 'template_import_eleves.csv'
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Template téléchargé avec succès');
    } catch (error) {
      toast.error('Erreur lors du téléchargement du template: ' + error.message);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setImportResult(null);
    setPreviewData(null);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={5000} />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Importation des Élèves</h1>
        <p className="text-gray-600 mt-2">
          Importez une liste d'élèves depuis un fichier CSV ou Excel
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800">Formats supportés</h3>
              <p className="text-sm text-blue-600">CSV, Excel (.xlsx, .xls)</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg mr-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-800">Champs requis</h3>
              <p className="text-sm text-green-600">Nom, Prénom, Classe, Niveau</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg mr-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-purple-800">Télécharger template</h3>
              <p className="text-sm text-purple-600">Structure prédéfinie</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="fileInput"
          />
          
          <label htmlFor="fileInput" className="cursor-pointer">
            {selectedFile ? (
              <div>
                <p className="text-lg font-medium text-gray-700">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Cliquez pour sélectionner un fichier
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  ou glissez-déposez votre fichier CSV ou Excel
                </p>
              </div>
            )}
          </label>

          <div className="mt-6 flex justify-center space-x-3">
            <button
              onClick={() => document.getElementById('fileInput').click()}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {selectedFile ? 'Changer de fichier' : 'Parcourir'}
            </button>
            
            {selectedFile && (
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-3">Téléchargez un template pour vous aider :</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => downloadTemplate('excel')}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Template Excel
            </button>
            <button
              onClick={() => downloadTemplate('csv')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Template CSV
            </button>
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-center space-x-4">
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {isPreviewing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline mr-2"></div>
                  Analyse en cours...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Prévisualiser
                </>
              )}
            </button>
            
            <button
              onClick={handleImport}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline mr-2"></div>
                  Importation en cours...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importer
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {previewData && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Prévisualisation des données</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="font-medium text-blue-800">Total des lignes</div>
              <div className="text-2xl font-bold">{previewData.totalRows}</div>
            </div>
            <div className={`p-4 rounded-lg ${previewData.validation?.valid ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="font-medium">Validation</div>
              <div className={`text-2xl font-bold ${previewData.validation?.valid ? 'text-green-800' : 'text-red-800'}`}>
                {previewData.validation?.valid ? '✓ Valide' : '✗ Invalide'}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="font-medium text-purple-800">En-têtes détectés</div>
              <div className="text-sm">{previewData.headers?.join(', ') || 'Aucun'}</div>
            </div>
          </div>

          {previewData.sampleData && previewData.sampleData.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Exemple de données (5 premières lignes)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewData.headers?.map((header, index) => (
                        <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.sampleData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {previewData.headers?.map((header, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 text-sm border">
                            {row[header] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previewData.validation?.errors?.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium mb-2 text-red-600">Erreurs de validation</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="overflow-y-auto max-h-60">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-sm font-medium text-red-800 px-2 py-1">Ligne</th>
                        <th className="text-left text-sm font-medium text-red-800 px-2 py-1">Champ</th>
                        <th className="text-left text-sm font-medium text-red-800 px-2 py-1">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.validation.errors.map((error, index) => (
                        <tr key={index}>
                          <td className="px-2 py-1 text-sm border-b">{error.ligne}</td>
                          <td className="px-2 py-1 text-sm border-b">{error.champ}</td>
                          <td className="px-2 py-1 text-sm border-b">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {importResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Résultats de l'importation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="font-medium text-green-800">Importés</div>
              <div className="text-3xl font-bold">{importResult.imported}</div>
              <div className="text-sm text-green-600">Nouveaux élèves</div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="font-medium text-blue-800">Mis à jour</div>
              <div className="text-3xl font-bold">{importResult.updated}</div>
              <div className="text-sm text-blue-600">Élèves existants</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="font-medium text-yellow-800">Ignorés</div>
              <div className="text-3xl font-bold">{importResult.skipped}</div>
              <div className="text-sm text-yellow-600">Lignes avec erreurs</div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="font-medium text-gray-800">Total</div>
              <div className="text-3xl font-bold">{importResult.total}</div>
              <div className="text-sm text-gray-600">Lignes traitées</div>
            </div>
          </div>

          {importResult.errors?.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium mb-2 text-red-600">Détails des erreurs ({importResult.errors.length})</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="overflow-y-auto max-h-60">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-sm font-medium text-red-800 px-2 py-1">Ligne</th>
                        <th className="text-left text-sm font-medium text-red-800 px-2 py-1">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((error, index) => (
                        <tr key={index}>
                          <td className="px-2 py-1 text-sm border-b">{error.ligne}</td>
                          <td className="px-2 py-1 text-sm border-b">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={resetForm}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Nouvelle importation
            </button>
          </div>
        </div>
      )}

      {!selectedFile && !previewData && !importResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions d'importation</h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-blue-100 text-blue-800 rounded-full p-2 mr-3">
                <span className="font-bold">1</span>
              </div>
              <div>
                <h3 className="font-medium">Téléchargez le template</h3>
                <p className="text-gray-600 text-sm">
                  Utilisez notre template Excel ou CSV pour garantir le bon format des données.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-blue-100 text-blue-800 rounded-full p-2 mr-3">
                <span className="font-bold">2</span>
              </div>
              <div>
                <h3 className="font-medium">Remplissez les données</h3>
                <p className="text-gray-600 text-sm">
                  Champs requis: Nom, Prénom, Classe, Niveau, Nom Père, Nom Mère, Téléphone Parent.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-blue-100 text-blue-800 rounded-full p-2 mr-3">
                <span className="font-bold">3</span>
              </div>
              <div>
                <h3 className="font-medium">Importez le fichier</h3>
                <p className="text-gray-600 text-sm">
                  Sélectionnez votre fichier, prévisualisez les données, puis importez.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-blue-100 text-blue-800 rounded-full p-2 mr-3">
                <span className="font-bold">4</span>
              </div>
              <div>
                <h3 className="font-medium">Vérifiez les résultats</h3>
                <p className="text-gray-600 text-sm">
                  Consultez le rapport d'importation pour voir les éventuelles erreurs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportEleves;
