import { ReactElement, ReactNode, isValidElement, Children } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { readWebapp } from './sourceFiles';

vi.mock('@/components', async () => {
  const React = await import('react');

  function When(props: { children?: ReactNode }) {
    return props.children as ReactElement;
  }

  function Otherwise(props: { children?: ReactNode }) {
    return props.children as ReactElement;
  }

  const Choose = Object.assign(
    function Choose(props: { children?: ReactNode }) {
      let when: ReactNode = null;
      let otherwise: ReactNode = null;

      Children.forEach(props.children, (child) => {
        if (!isValidElement(child)) {
          return;
        }
        const condition = (child.props as { condition?: boolean }).condition;
        if (condition === undefined) {
          otherwise = child;
        } else if (!when && condition === true) {
          when = child;
        }
      });

      return (when || otherwise) as ReactElement;
    },
    { When, Otherwise },
  );

  return {
    Box: (props: { children?: ReactNode; style?: object }) =>
      React.createElement('div', { style: props.style }, props.children),
    Icon: () => null,
    IconProps: {},
    For: (props: {
      of: unknown[];
      render: (item: unknown, index: number) => ReactNode;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        props.of.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: index },
            props.render(item, index),
          ),
        ),
      ),
    FormattedMessage: (props: { id: string }) => props.id,
    Choose,
  };
});

vi.mock('@blueprintjs/core', () => {
  const element =
    (tag: string) =>
    (props: {
      children?: ReactNode;
      text?: ReactNode;
      content?: ReactNode;
      rightIcon?: ReactNode;
    }) => {
      const React = require('react') as typeof import('react');
      return React.createElement(
        tag,
        null,
        props.children,
        props.text,
        props.content,
        props.rightIcon,
      );
    };

  return {
    Button: element('button'),
    InputGroup: element('div'),
    Popover: element('div'),
    Menu: element('div'),
    MenuItem: element('div'),
    MenuDivider: element('div'),
    Spinner: element('div'),
    Position: { BOTTOM: 'bottom' },
    Classes: {
      ICON: 'bp4-icon',
      iconClass: (icon: string) => `bp4-icon-${icon}`,
      intentClass: () => '',
    },
    Props: {},
  };
});

vi.mock('@xstyled/emotion', () => {
  const React = require('react') as typeof import('react');
  const styled = (tag: string) => () => {
    return function Styled(props: {
      children?: ReactNode;
      className?: string;
    }) {
      return React.createElement(
        tag,
        { className: props.className },
        props.children,
      );
    };
  };
  const x = new Proxy(
    {},
    {
      get: () => (props: { children?: ReactNode }) =>
        React.createElement('div', null, props.children),
    },
  );

  return { default: styled, x };
});

vi.mock('react-intl-universal', () => ({
  default: {
    get: (id: string, options?: { fallback?: string }) =>
      options?.fallback ?? id,
    formatHTMLMessage: (descriptor: { id: string }) => descriptor.id,
  },
}));

vi.mock('react-body-classname', () => ({
  default: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('react-transition-group', () => ({
  TransitionGroup: (props: { children?: ReactNode }) => props.children,
  CSSTransition: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('@/routes/authentication', () => ({ default: [] }));

vi.mock('@/containers/Authentication/AuthMetaBoot', () => ({
  AuthMetaBootProvider: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('@/containers/Drawer/withDrawerActions', () => ({
  withDrawerActions:
    (Component: (props: object) => ReactElement) => (props: object) => {
      const React = require('react') as typeof import('react');
      return React.createElement(Component, {
        ...props,
        openDrawer: () => undefined,
        closeDrawer: () => undefined,
      });
    },
}));

vi.mock('@/hooks/query', () => ({
  useAuthenticatedAccount: () => ({
    data: { firstName: 'Ada', lastName: 'Lovelace' },
  }),
  useCurrentOrganizationMetadata: () => ({ name: 'Acme Books' }),
}));

vi.mock('@/hooks/state', () => ({
  useAuthOrganizationId: () => 'org-1',
  useAuthActions: () => ({ setLogout: () => undefined }),
}));

vi.mock('@/ee/workspaces/hooks/query', () => ({
  useWorkspaces: () => ({ data: [] }),
}));

vi.mock('@/ee/workspaces/hooks/useSwitchOrganization', () => ({
  useSwitchOrganization: () => () => undefined,
}));

const DEFAULT_MARK = '<span class="brand-mark" aria-label="Evena">E</span>';
const SMALL_MARK =
  '<span class="brand-mark brand-mark--sm" aria-label="Evena">E</span>';
const REPO_URL = ['https://github.com', 'shredder97', 'bigcapital'].join('/');

function expectMark(html: string, mark: string) {
  expect(html).toContain(mark);
  expect(html).not.toContain('data-icon="bigcapital"');
  expect(html).not.toContain('data-icon="mini-bigcapital"');
  expect(html).not.toContain('data-icon="bigcapital-alt"');
  expect(html).not.toContain(REPO_URL);
  expect(html).not.toContain('based on Bigcapital');
}

describe('BrandMark call sites', () => {
  it('renders the default E in the authentication shell', async () => {
    const { Authentication } = await import(
      '@/containers/Authentication/Authentication'
    );
    const view = renderToStaticMarkup(
      <MemoryRouter>
        <Authentication />
      </MemoryRouter>,
    );
    expectMark(view, DEFAULT_MARK);
    expect(view).not.toContain('brand-mark--sm');
  });

  it('drops the dark-mode wordmark branch from the authentication shell', () => {
    const source = readWebapp(
      'src/containers/Authentication/Authentication.tsx',
    );
    expect(source).toContain('<BrandMark />');
    expect(source).not.toContain('useIsDarkMode');
    expect(source).not.toContain('BigcapitalAlt');
    expect(source).not.toContain('icon="bigcapital"');
  });

  it('renders the default E in AuthContainer', async () => {
    const { AuthContainer } = await import(
      '@/containers/Authentication/AuthContainer'
    );
    const view = renderToStaticMarkup(
      <AuthContainer>
        <p>Reset</p>
      </AuthContainer>,
    );
    expect(view).toContain('Reset');
    expectMark(view, DEFAULT_MARK);
  });

  it('renders the small E on the copyright line', async () => {
    const { AuthCopyright } = await import(
      '@/containers/Authentication/AuthCopyright'
    );
    expectMark(renderToStaticMarkup(<AuthCopyright />), SMALL_MARK);
  });

  it('renders the default E on the splash loader', async () => {
    const { default: BigcapitalLoading } = await import(
      '@/components/Dashboard/BigcapitalLoading'
    );
    const view = renderToStaticMarkup(<BigcapitalLoading />);
    expectMark(view, DEFAULT_MARK);
    expect(view).toContain('bigcapital-loading');
  });

  it('shows the splash E only while the dashboard is loading', async () => {
    const { default: DashboardLoadingIndicator } = await import(
      '@/components/Dashboard/DashboardLoadingIndicator'
    );
    expectMark(
      renderToStaticMarkup(
        <DashboardLoadingIndicator isLoading>Ready</DashboardLoadingIndicator>,
      ),
      DEFAULT_MARK,
    );
    const view = renderToStaticMarkup(
      <DashboardLoadingIndicator>Ready</DashboardLoadingIndicator>,
    );
    expect(view).toContain('Ready');
    expect(view).not.toContain('brand-mark');
  });

  it('stops branching the splash logo on color mode', () => {
    const source = readWebapp('src/components/Dashboard/BigcapitalLoading.tsx');
    expect(source).toContain('<BrandMark />');
    expect(source).not.toContain('useIsDarkMode');
    expect(source).not.toContain('bigcapital-alt');
    expect(source).not.toContain('icon="bigcapital"');
  });

  it('renders the small E in the dashboard error boundary', async () => {
    const { default: DashboardErrorBoundary } = await import(
      '@/components/Dashboard/DashboardErrorBoundary'
    );
    const view = renderToStaticMarkup(<DashboardErrorBoundary />);
    expect(view).toContain('sorry_about_that_something_went_wrong');
    expectMark(view, SMALL_MARK);
  });

  it('renders the default E in the setup wizard', async () => {
    const { SetupLeftSection } = await import(
      '@/containers/Setup/SetupLeftSection'
    );
    const view = renderToStaticMarkup(<SetupLeftSection />);
    expect(view).toContain('setup.left_side.title');
    expect(view).toContain('http://bigcapital.ly');
    expectMark(view, DEFAULT_MARK);
  });

  it('keeps the footer links under the setup mark', () => {
    const source = readWebapp('src/containers/Setup/SetupLeftSection.tsx');
    expect(source).toContain('<BrandMark />');
    expect(source).toContain('getFooterLinks');
    expect(source).not.toContain('bigcapital--alt');
    expect(source).not.toContain('icon="bigcapital"');
  });

  it('renders the small E inside the sidebar logo slot', async () => {
    const { SidebarHead } = await import(
      '@/containers/Dashboard/Sidebar/SidebarHead'
    );
    const view = renderToStaticMarkup(<SidebarHead />);
    expect(view).toContain('sidebar__head-logo');
    expect(view).toContain('Acme Books');
    expect(view).toContain('Ada');
    expectMark(view, SMALL_MARK);
  });

  it('keeps the sidebar logo wrapper around the small mark', () => {
    const source = readWebapp(
      'src/containers/Dashboard/Sidebar/SidebarHead.tsx',
    );
    expect(source).toContain('className="sidebar__head-logo"');
    expect(source).toContain('<BrandMark className="brand-mark--sm" />');
    expect(source).not.toContain('mini-bigcapital');
    expect(source).not.toContain('bigcapital--alt');
  });

  it('keeps login, register, reset, and invite on the shared copyright slot', () => {
    const pages = [
      'src/containers/Authentication/Login.tsx',
      'src/containers/Authentication/Register.tsx',
      'src/containers/Authentication/SendResetPassword.tsx',
      'src/containers/Authentication/ResetPassword.tsx',
      'src/containers/Authentication/InviteAccept.tsx',
    ];

    for (const page of pages) {
      expect(readWebapp(page)).toContain('<AuthInsider');
    }
  });
});
