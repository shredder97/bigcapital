import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  formatHits,
  readRepo,
  readWebapp,
  searchSource,
  webappRoot,
} from './sourceFiles';
import {
  COMMUNITY_BIGCAPITAL_LINK,
  DOCS_BIGCAPITAL_LINK,
} from '@/constants/routes';

const REPO_URL = ['https://github.com', 'shredder97', 'bigcapital'].join('/');

describe('attribution left in place', () => {
  it('keeps the AGPL license', () => {
    expect(readRepo('LICENSE')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  });

  it('keeps the Palantir header on MenuItem', () => {
    const header = readWebapp('src/components/Menu/MenuItem.tsx').slice(0, 700);
    expect(header).toContain('Copyright 2015 Palantir Technologies, Inc.');
    expect(header).toContain('Apache License, Version 2.0');
  });

  it('keeps the Palantir header on Icon', () => {
    const header = readWebapp('src/components/Icon/index.tsx').slice(0, 700);
    expect(header).toContain('Copyright 2017 Palantir Technologies, Inc.');
    expect(header).toContain('Apache License, Version 2.0');
  });

  it('keeps footer links, including the Bigcapital site link', () => {
    const source = readWebapp('src/constants/footerLinks.tsx');
    expect(source).toContain("link: 'https://docs.bigcapital.ly/blog'");
    expect(source).toContain("link: 'https://discord.com/invite/c8nPBJafeb'");
    expect(source).toContain("link: 'https://docs.bigcapital.ly'");
    expect(source).toContain("title: 'Bigcapital'");
    expect(source).toContain("link: 'http://bigcapital.ly'");
  });

  it('keeps the docs and community constants', () => {
    expect(DOCS_BIGCAPITAL_LINK).toBe('https://docs.bigcapital.app');
    expect(COMMUNITY_BIGCAPITAL_LINK).toBe('https://community.bigcapital.app');
  });

  it('keeps the payment portal legal name', () => {
    expect(
      readWebapp('src/containers/PaymentPortal/PaymentPage.tsx'),
    ).toContain('you allow Bigcapital Technology, Inc. to charge you');
    expect(
      readWebapp('src/containers/PaymentPortal/PaymentPage.tsx'),
    ).toContain('© 2024 Bigcapital Technology, Inc.');
    expect(
      readWebapp('src/containers/PaymentPortal/PaymentPortal.tsx'),
    ).toContain('Bigcapital Technology, Inc.');
    expect(
      readWebapp('src/containers/PaymentPortal/InvoicePaymentPagePreview.tsx'),
    ).toContain("organizationName={'Bigcapital Technology, Inc.'}");
  });

  it('keeps the sidebar version label', () => {
    expect(
      readWebapp('src/containers/Dashboard/Sidebar/Sidebar.tsx'),
    ).toContain('v{REACT_APP_VERSION}');
  });

  it('keeps the favicon file', () => {
    expect(
      existsSync(path.join(webappRoot, 'public/favicons/favicon-32.ico')),
    ).toBe(true);
  });

  it('keeps the webapp package name', () => {
    expect(readWebapp('package.json')).toContain(
      '"name": "@bigcapital/webapp"',
    );
  });

  it('does not link the UI at the repository', () => {
    const hits = searchSource(
      new RegExp(REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    expect(formatHits(hits)).toBe('');
    expect(readWebapp('index.html')).not.toContain(REPO_URL);
  });

  it('does not add the rejected auth footer sentence', () => {
    const hits = searchSource(/based on Bigcapital/);
    expect(formatHits(hits)).toBe('');
  });
});
