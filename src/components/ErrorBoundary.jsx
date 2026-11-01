import { t } from '../i18n/config.js';
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="app-shell"><section className="empty-state" role="alert"><h1>{t("The platform could not display this view.")}</h1><p>{t("Your saved records are unaffected. Reload to try again.")}</p><button className="primary-button" onClick={() => window.location.reload()}>{t("Reload platform")}</button></section></main>;
    return this.props.children;
  }
}
