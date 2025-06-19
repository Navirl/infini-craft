import React, { useState } from 'react';

interface PromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  addUserPrompt: string;
  setAddUserPrompt: (text: string) => void;
  splitUserPrompt: string;
  setSplitUserPrompt: (text: string) => void;
  useCustomPrompt: boolean;
  setUseCustomPrompt: (value: boolean) => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '20px',
  borderRadius: '8px',
  width: '90%',
  maxWidth: '600px',
  maxHeight: '80vh',
  overflowY: 'auto',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  height: '200px',
  fontFamily: 'monospace',
};

const tabStyle: React.CSSProperties = {
  padding: '10px',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  borderBottom: '2px solid #007bff',
};

const PromptEditor: React.FC<PromptEditorProps> = ({
  isOpen,
  onClose,
  addUserPrompt,
  setAddUserPrompt,
  splitUserPrompt,
  setSplitUserPrompt,
  useCustomPrompt,
  setUseCustomPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'add' | 'split'>('add');

  if (!isOpen) return null;

  const handleSave = () => {
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2>Edit Prompts</h2>
        
        <div style={{ display: 'flex', marginBottom: '10px' }}>
          <div 
            style={activeTab === 'add' ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab('add')}
          >
            Add Prompt
          </div>
          <div 
            style={activeTab === 'split' ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab('split')}
          >
            Split Prompt
          </div>
        </div>
        
        {activeTab === 'add' && (
          <>
            <h3>System Message (fixed):</h3>
            <pre>You are an API that returns JSON.</pre>
            
            <h3>User Message:</h3>
            <textarea
              style={textareaStyle}
              value={addUserPrompt}
              onChange={(e) => setAddUserPrompt(e.target.value)}
              placeholder="Combine {{symbol1}} and {{symbol2}}..."
            />
          </>
        )}
        
        {activeTab === 'split' && (
          <>
            <h3>System Message (fixed):</h3>
            <pre>You are an API that returns JSON.</pre>
            
            <h3>User Message:</h3>
            <textarea
              style={textareaStyle}
              value={splitUserPrompt}
              onChange={(e) => setSplitUserPrompt(e.target.value)}
              placeholder="Split {{symbol}}..."
            />
          </>
        )}
        
        <div style={{ marginTop: '10px' }}>
          <label style={{ marginRight: '10px' }}>
            <input
              type="checkbox"
              checked={useCustomPrompt}
              onChange={(e) => setUseCustomPrompt(e.target.checked)}
            />{' '}
            Use custom prompts for API calls
          </label>
        </div>
        
        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          <button onClick={handleSave}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;
