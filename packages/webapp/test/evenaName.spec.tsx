import { readFileSync } from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Helmet } from 'react-helmet';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { describe, expect, it } from 'vitest';
import DashboardDocumentTitle from '@/components/Dashboard/DashboardDocumentTitle';
import { App } from '@/constants/app';
import en from '@/lang/en/index.json';

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

function shellDocument(): { title: string; description: string } {
  const html = readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const title = html.match(/<title>([^<]*)<\/title>/);
  const description = html.match(
    /<meta[^>]*name="description"[^>]*content="([^"]*)"/,
  );

  if (!title?.[1] || !description?.[1]) {
    throw new Error('shell document is missing a title or description');
  }

  return { title: title[1], description: description[1] };
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

  Helmet.canUseDOM = false;
  renderToStaticMarkup(
    <Provider store={createStore(() => ({ dashboard }))}>
      <DashboardDocumentTitle />
    </Provider>,
  );

  return Helmet.renderStatic().title.toString();
}

describe('Evena name', () => {
  it('titles the shell document Evena', () => {
    expect(shellDocument()).toEqual({
      title: 'Evena',
      description: 'Evena Financial Managment Software',
    });
  });

  it('exposes Evena as the application name', () => {
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

  it('asks for an Evena account', () => {
    expect(en.need_bigcapital_account).toBe('Need a Evena account ?');
  });

  it('welcomes the user to Evena', () => {
    expect(en.welcome_to_bigcapital).toBe('Welcome to Evena');
  });

  it('says the sign-in address is for Evena', () => {
    expect(en.you_will_use_this_address_to_sign_in_to_bigcapital).toBe(
      'You will use this address to sign in to Evena.',
    );
  });

  it('describes the setup account as Evena', () => {
    expect(en['setup.left_side.description']).toBe('You have a Evena account');
  });

  it('labels the cash-flow balance as Evena', () => {
    expect(en['cash_flow_transaction.balance_in_bigcapital']).toBe(
      'Balance in Evena',
    );
  });

  it('keeps the external bigcapital.ly link label', () => {
    expect(en.go_to_bigcapital_com).toBe('← Go to bigcapital.ly');
  });
});
