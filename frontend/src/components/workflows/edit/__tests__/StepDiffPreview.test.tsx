import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StepDiffPreview from '../StepDiffPreview';
import { WorkflowStep } from '@/types/workflow';

// Mock the icons since they might cause issues in some test environments
jest.mock('react-icons/fi', () => ({
  FiCheck: () => <div data-testid="icon-check" />,
  FiX: () => <div data-testid="icon-x" />,
  FiArrowRight: () => <div data-testid="icon-arrow-right" />,
  FiActivity: () => <div data-testid="icon-activity" />,
  FiCpu: () => <div data-testid="icon-cpu" />,
  FiType: () => <div data-testid="icon-type" />,
  FiSettings: () => <div data-testid="icon-settings" />,
  FiLayers: () => <div data-testid="icon-layers" />,
  FiFileText: () => <div data-testid="icon-file-text" />,
}));

describe('StepDiffPreview', () => {
  const mockOriginalStep: WorkflowStep = {
    step_name: 'Original Step',
    step_description: 'Original Description',
    model: 'gpt-4',
    step_type: 'ai_generation',
    step_order: 1,
  };

  const mockProposedStep: WorkflowStep = {
    step_name: 'Updated Step',
    step_description: 'Updated Description',
    model: 'gpt-4',
    step_type: 'ai_generation',
    step_order: 1,
  };

  const mockOnAccept = jest.fn();
  const mockOnReject = jest.fn();

  it('renders changes correctly', () => {
    render(
      <StepDiffPreview
        original={mockOriginalStep}
        proposed={mockProposedStep}
        action="update"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    // Check header
    expect(screen.getByText('✨ Changes Proposed by AI')).toBeInTheDocument();

    // Check diffs
    expect(screen.getByText('Step Name')).toBeInTheDocument();
    expect(screen.getByText('Original Step')).toBeInTheDocument();
    expect(screen.getByText('Updated Step')).toBeInTheDocument();

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Original Description')).toBeInTheDocument();
    expect(screen.getByText('Updated Description')).toBeInTheDocument();
  });

  it('renders new step addition correctly', () => {
    render(
      <StepDiffPreview
        proposed={mockProposedStep}
        action="add"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText('✨ New Step Proposed')).toBeInTheDocument();
    expect(screen.getByText('Updated Step')).toBeInTheDocument();
    // Should not show "Before" values for add action
    expect(screen.queryByText('Original Step')).not.toBeInTheDocument();
  });

  it('calls onAccept when accept button is clicked', () => {
    render(
      <StepDiffPreview
        original={mockOriginalStep}
        proposed={mockProposedStep}
        action="update"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    fireEvent.click(screen.getByText('Apply Changes'));
    expect(mockOnAccept).toHaveBeenCalled();
  });

  it('calls onReject when reject button is clicked', () => {
    render(
      <StepDiffPreview
        original={mockOriginalStep}
        proposed={mockProposedStep}
        action="update"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    fireEvent.click(screen.getByText('Reject'));
    expect(mockOnReject).toHaveBeenCalled();
  });
});
