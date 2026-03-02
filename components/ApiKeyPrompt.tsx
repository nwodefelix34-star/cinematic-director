import React from 'react';

interface ApiKeyPromptProps {
  onSuccess: () => void;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onSuccess }) => {
  const handleOpenSelect = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      onSuccess();
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-6">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-key text-2xl"></i>
        </div>
        <h2 className="text-2xl font-bold mb-4">Gemini Veo Access</h2>
        <p className="text-slate-400 mb-6 text-sm leading-relaxed">
          To generate cinematic videos with Veo 3.1, you must select an API key from a paid Google Cloud project.
        </p>
        <div className="bg-slate-900/50 rounded-lg p-4 mb-8 text-xs text-left text-slate-400 border border-slate-700">
          <p className="flex items-center gap-2 mb-2">
            <i className="fas fa-info-circle text-blue-400"></i>
            <span>Video generation requires billing setup.</span>
          </p>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Learn about Gemini API billing
          </a>
        </div>
        <button
          onClick={handleOpenSelect}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20"
        >
          Select Paid API Key
          <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};

export default ApiKeyPrompt;

