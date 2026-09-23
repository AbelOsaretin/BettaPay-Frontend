import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/components/shared/EmptyState';

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const Button = React.forwardRef(
    ({ className, children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>, ref: React.Ref<HTMLButtonElement>) => (
      <button ref={ref} className={className} onClick={onClick} {...props}>
        {children}
      </button>
    ),
  );
  Button.displayName = 'Button';
  return { Button };
});

const MockIcon = React.forwardRef(function MockIconInner(
  { className }: { className?: string },
  _ref: React.Ref<SVGSVGElement>,
) {
  return <svg data-testid="mock-icon" className={className} />;
});
MockIcon.displayName = 'MockIcon';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState icon={MockIcon} title="No data found" />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <EmptyState
        icon={MockIcon}
        title="No data"
        description="There is nothing to show here."
      />,
    );
    expect(screen.getByText('There is nothing to show here.')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState icon={MockIcon} title="No data" />);
    expect(screen.queryByText('There is nothing to show here.')).not.toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<EmptyState icon={MockIcon} title="Empty" />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('renders the CTA button when action is provided', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        icon={MockIcon}
        title="Empty"
        action={{ label: 'Create Something', onClick }}
      />,
    );
    const button = screen.getByText('Create Something');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render CTA button when action is not provided', () => {
    render(<EmptyState icon={MockIcon} title="Empty" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders secondary action when provided', () => {
    const onSecondary = jest.fn();
    render(
      <EmptyState
        icon={MockIcon}
        title="Empty"
        action={{ label: 'Primary', onClick: jest.fn() }}
        secondaryAction={{ label: 'Secondary', onClick: onSecondary }}
      />,
    );
    const secondaryBtn = screen.getByText('Secondary');
    expect(secondaryBtn).toBeInTheDocument();
    fireEvent.click(secondaryBtn);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('has role="status" for accessibility', () => {
    render(<EmptyState icon={MockIcon} title="Empty" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies compact styles when compact is true', () => {
    const { container } = render(
      <EmptyState icon={MockIcon} title="Compact" compact />,
    );
    const statusDiv = container.querySelector('[role="status"]');
    expect(statusDiv?.className).toContain('py-6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState icon={MockIcon} title="Custom" className="custom-class" />,
    );
    const statusDiv = container.querySelector('[role="status"]');
    expect(statusDiv?.className).toContain('custom-class');
  });
});
