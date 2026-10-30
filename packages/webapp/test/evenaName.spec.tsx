import { renderToStaticMarkup } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { describe, expect, it } from 'vitest';
import { readWebapp } from './sourceFiles';
import DashboardDocumentTitle from '@/components/Dashboard/DashboardDocumentTitle';
import { App } from '@/constants/app';
import ar from '@/lang/ar/index.json';
import en from '@/lang/en/index.json';
import es from '@/lang/es/index.json';
import sv from '@/lang/sv/index.json';

interface DashboardSlice {
  pageTitle: string;
  pageSubtitle: string;
  pageHint: string;
  topbarEditViewId: null;
  sidebarExpended: boolean;
  preferencesPageTitle: string;
  backLink: boolean;
  splashScreenLoading: number;
}

function documentTitle(pageTitle: string, preferencesPageTitle = ''): string {
  const dashboard: DashboardSlice = {
    pageTitle,
    pageSubtitle: '',
    pageHint: '',
    topbarEditViewId: null,
    sidebarExpended: true,
    preferencesPageTitle,
    backLink: false,
    splashScreenLoading: 0,
  };
  const store = createStore(() => ({ dashboard }));

  Helmet.canUseDOM = false;
  renderToStaticMarkup(
    <Provider store={store}>
      <DashboardDocumentTitle />
    </Provider>,
  );

  return Helmet.renderStatic().title.toString();
}

describe('Evena product name', () => {
  it('sets the document title to Evena', () => {
    expect(readWebapp('index.html')).toContain('<title>Evena</title>');
  });

  it('replaces Bigcapital in the meta description and keeps the existing wording', () => {
    expect(readWebapp('index.html')).toContain(
      'content="Evena Financial Managment Software"',
    );
  });

  it('keeps the favicon reference', () => {
    expect(readWebapp('index.html')).toContain(
      'href="/favicons/favicon-32.ico"',
    );
  });

  it('exposes Evena as app_name for the dashboard helmet', () => {
    expect(App.app_name).toBe('Evena');
  });

  it('titles a dashboard page as "<Page> | Evena"', () => {
    expect(documentTitle('Invoices')).toContain('Invoices | Evena');
  });

  it('uses the preferences title in front of Evena', () => {
    expect(documentTitle('', 'Settings')).toContain('Settings | Evena');
  });

  it('uses Evena alone when the dashboard has no page title', () => {
    const title = documentTitle('');
    expect(title).toContain('Evena');
    expect(title).not.toContain('|');
  });

  it('renames the account prompt', () => {
    expect(en.need_bigcapital_account).toBe('Need a Evena account ?');
  });

  it('renames the welcome string', () => {
    expect(en.welcome_to_bigcapital).toBe('Welcome to Evena');
  });

  it('renames the sign-in address sentence', () => {
    expect(en.you_will_use_this_address_to_sign_in_to_bigcapital).toBe(
      'You will use this address to sign in to Evena.',
    );
  });

  it('renames the setup description', () => {
    expect(en['setup.left_side.description']).toBe('You have a Evena account');
  });

  it('renames the cash-flow balance label', () => {
    expect(en['cash_flow_transaction.balance_in_bigcapital']).toBe(
      'Balance in Evena',
    );
  });

  it('keeps the external bigcapital.ly link label', () => {
    expect(en.go_to_bigcapital_com).toBe('← Go to bigcapital.ly');
  });

  it('keeps the English message keys', () => {
    expect(en).toHaveProperty('need_bigcapital_account');
    expect(en).toHaveProperty('welcome_to_bigcapital');
    expect(en).toHaveProperty(
      'you_will_use_this_address_to_sign_in_to_bigcapital',
    );
    expect(en).toHaveProperty('go_to_bigcapital_com');
    expect(en).toHaveProperty('setup.left_side.description');
    expect(en).toHaveProperty('cash_flow_transaction.balance_in_bigcapital');
  });

  it('leaves Swedish copy unchanged', () => {
    expect(sv.welcome_to_bigcapital).toBe('Välkommen till Bigcapital');
    expect(sv['setup.left_side.description']).toContain('Bigcapital');
  });

  it('leaves Spanish copy unchanged', () => {
    expect(es.welcome_to_bigcapital).toBe('Bienvenido a Bigcapital');
    expect(es['cash_flow_transaction.balance_in_bigcapital']).toContain(
      'Bigcapital',
    );
  });

  it('leaves Arabic copy unchanged', () => {
    expect(ar.welcome_to_bigcapital).toContain('Bigcapital');
    expect(ar.you_have_a_bigcapital_account).toContain('Bigcapital');
  });
});
