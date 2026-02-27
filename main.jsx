import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Simple storage polyfill for local use
if (!window.storage) {
  window.storage = {
    _store: JSON.parse(localStorage.getItem('crm_storage') || '{}'),
    _save() { localStorage.setItem('crm_storage', JSON.stringify(this._store)); },
    async get(key) {
      const val = this._store[key];
      if (val === undefined) throw new Error('Key not found: ' + key);
      return { key, value: val };
    },
    async set(key, value) {
      this._store[key] = value;
      this._save();
      return { key, value };
    },
    async delete(key) {
      delete this._store[key];
      this._save();
      return { key, deleted: true };
    },
    async list(prefix = '') {
      const keys = Object.keys(this._store).filter(k => k.startsWith(prefix));
      return { keys };
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
