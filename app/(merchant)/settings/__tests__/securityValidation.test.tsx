import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../page';

const mockNotifySuccess = jest.fn();
jest.mock('@/lib/hooks/useNotify', () => ({
  useNotify: () => ({
    success: mockNotifySuccess,
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('@/lib/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'usr_1', email: 'merchant@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/api/hooks', () => ({
  useMerchantProfile: () => ({
    data: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/lib/api/axios', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: {} }),
    get: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('SettingsPage - Password Security Validation (#320)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const openSecurityTab = () => {
    render(<SettingsPage />);
    const securityTab = screen.getByText('Security');
    fireEvent.click(securityTab);
  };

  it('renders security tab with password fields and disabled Update Password button', () => {
    openSecurityTab();

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    expect(submitBtn).toBeDisabled();
  });

  it('validates current password non-empty requirement', () => {
    openSecurityTab();

    const inputs = screen.getAllByPlaceholderText('••••••••');
    const [currentPwdInput] = inputs;

    fireEvent.change(currentPwdInput, { target: { value: 'a' } });
    fireEvent.change(currentPwdInput, { target: { value: '' } });
    fireEvent.blur(currentPwdInput);

    expect(screen.getByText('Current password is required')).toBeInTheDocument();
  });

  it('validates new password rules (min 8 chars, 1 uppercase, 1 number)', () => {
    openSecurityTab();

    const inputs = screen.getAllByPlaceholderText('••••••••');
    const [, newPwdInput] = inputs;

    // Too short
    fireEvent.change(newPwdInput, { target: { value: 'Ab1' } });
    expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();

    // No uppercase
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    expect(screen.getByText('Password must contain at least one uppercase letter')).toBeInTheDocument();

    // No number
    fireEvent.change(newPwdInput, { target: { value: 'Password' } });
    expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
  });

  it('validates confirm password matching requirement', () => {
    openSecurityTab();

    const inputs = screen.getAllByPlaceholderText('••••••••');
    const [, newPwdInput, confirmPwdInput] = inputs;

    fireEvent.change(newPwdInput, { target: { value: 'StrongPass1' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'WrongPass2' } });

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('enables submit button and allows updating when all validations pass', async () => {
    openSecurityTab();

    const inputs = screen.getAllByPlaceholderText('••••••••');
    const [currentPwdInput, newPwdInput, confirmPwdInput] = inputs;
    const submitBtn = screen.getByRole('button', { name: /Update Password/i });

    expect(submitBtn).toBeDisabled();

    fireEvent.change(currentPwdInput, { target: { value: 'oldPassword123' } });
    fireEvent.change(newPwdInput, { target: { value: 'NewSecure1' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'NewSecure1' } });

    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('Password updated'));
  });
});
