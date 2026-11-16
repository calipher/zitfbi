import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary.tsx';

describe('React ErrorBoundary Fault Isolation & Recovery', () => {
  it('renders child markup cleanly when no error has occurred', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorBoundary, {
        scope: 'module',
        moduleName: 'Exhibitor Intelligence',
        children: React.createElement('div', { id: 'ok-child' }, 'Nominal ZITF Workspace'),
      })
    );
    assert.ok(html.includes('Nominal ZITF Workspace'));
    assert.ok(!html.includes('Unable to render'));
  });

  it('transitions to isolated fallback state on getDerivedStateFromError and exposes recovery actions', () => {
    const derived = ErrorBoundary.getDerivedStateFromError(new Error('Chart data null reference'));
    assert.equal(derived.hasError, true);
    assert.equal(derived.error?.message, 'Chart data null reference');

    let resetCalled = false;
    let safeNavCalled = false;
    const instance = new ErrorBoundary({
      scope: 'module',
      moduleName: 'Commercial Intelligence',
      children: React.createElement('div', null, 'Safe child'),
      onReset: () => {
        resetCalled = true;
      },
      onNavigateSafe: () => {
        safeNavCalled = true;
      },
    });

    // Simulate React error boundary state + render fallback output
    instance.state = {
      hasError: true,
      error: new Error('Chart data null reference'),
      componentStack: '\n    at RevenueChart',
      showDetails: false,
      reportStatus: 'idle',
    };

    const fallbackNode = instance.render();
    const html = renderToStaticMarkup(fallbackNode as React.ReactElement);

    assert.ok(html.includes('Unable to render Commercial Intelligence'));
    assert.ok(html.includes('Chart data null reference'));
    assert.ok(html.includes('Retry Module'));
    assert.ok(html.includes('Return to Safe Home'));
    assert.ok(html.includes('Reload Application'));

    // Mock setState to verify recovery callbacks without mounted DOM
    instance.setState = ((partial: any) => {
      instance.state = {
        ...instance.state,
        ...(typeof partial === 'function' ? partial(instance.state) : partial),
      };
    }) as any;

    instance.handleRetry();
    assert.equal(instance.state.hasError, false);
    assert.equal(resetCalled, true);

    instance.state = { ...instance.state, hasError: true };
    instance.handleNavigateSafe();
    assert.equal(instance.state.hasError, false);
    assert.equal(safeNavCalled, true);
  });

  it('renders compact isolated widget fallback when scope="widget"', () => {
    const instance = new ErrorBoundary({
      scope: 'widget',
      moduleName: 'Ask ZITF Intelligence',
      children: React.createElement('div', null, 'Assistant'),
    });
    instance.state = {
      hasError: true,
      error: new Error('Assistant parse error'),
      componentStack: '',
      showDetails: false,
      reportStatus: 'sent',
    };
    const html = renderToStaticMarkup(instance.render() as React.ReactElement);
    assert.ok(html.includes('Ask ZITF Intelligence encountered a display error'));
    assert.ok(html.includes('Retry Widget'));
    assert.ok(html.includes('Incident recorded to server error log'));
  });
});
