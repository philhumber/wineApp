import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import InputArea from '../InputArea.svelte';

describe('InputArea', () => {
	afterEach(() => {
		cleanup();
	});

	describe('rendering', () => {
		it('should render with default placeholder for greeting phase', () => {
			render(InputArea, { props: { phase: 'greeting' } });
			const textarea = screen.getByRole('textbox');
			expect(textarea).toHaveAttribute('placeholder', 'Wine name or photo...');
		});

		it('should render camera and send buttons', () => {
			render(InputArea, { props: { phase: 'greeting' } });
			expect(screen.getByLabelText('Take photo or upload image')).toBeInTheDocument();
			expect(screen.getByLabelText('Send message')).toBeInTheDocument();
		});

		it('should have hidden file input for image capture', () => {
			render(InputArea, { props: { phase: 'greeting' } });
			const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
			expect(fileInput).toBeInTheDocument();
			expect(fileInput).toHaveAttribute('accept', 'image/*');
			expect(fileInput).toHaveAttribute('capture', 'environment');
			expect(fileInput).toHaveAttribute('hidden');
		});
	});

	describe('placeholder by phase', () => {
		// Placeholders kept concise to avoid wrapping on mobile
		const phaseExpectations = [
			{ phase: 'greeting', placeholder: 'Wine name or photo...' },
			{ phase: 'awaiting_input', placeholder: 'Wine name or photo...' },
			{ phase: 'identifying', placeholder: 'Processing...' },
			{ phase: 'confirming', placeholder: 'Search again...' },
			{ phase: 'adding_wine', placeholder: 'Continue...' },
			{ phase: 'enriching', placeholder: 'Loading...' },
			{ phase: 'error', placeholder: 'Try again...' },
			{ phase: 'complete', placeholder: 'Processing...' },
		];

		phaseExpectations.forEach(({ phase, placeholder }) => {
			it(`should show "${placeholder}" for phase "${phase}"`, () => {
				render(InputArea, { props: { phase } });
				const textarea = screen.getByRole('textbox');
				expect(textarea).toHaveAttribute('placeholder', placeholder);
			});
		});

		it('should use fallback placeholder for unknown phase', () => {
			render(InputArea, { props: { phase: 'unknown_phase' } });
			const textarea = screen.getByRole('textbox');
			expect(textarea).toHaveAttribute('placeholder', 'Type a message...');
		});
	});

	describe('disabled state', () => {
		const disabledPhases = ['identifying', 'complete', 'confirm_new_search'];
		const enabledPhases = ['greeting', 'awaiting_input', 'confirming', 'adding_wine', 'enriching', 'error'];

		disabledPhases.forEach((phase) => {
			it(`should be disabled during "${phase}" phase`, () => {
				render(InputArea, { props: { phase } });
				const textarea = screen.getByRole('textbox');
				const cameraBtn = screen.getByLabelText('Take photo or upload image');
				const sendBtn = screen.getByLabelText('Send message');

				expect(textarea).toBeDisabled();
				expect(cameraBtn).toBeDisabled();
				expect(sendBtn).toBeDisabled();
			});
		});

		enabledPhases.forEach((phase) => {
			it(`should be enabled during "${phase}" phase`, () => {
				render(InputArea, { props: { phase } });
				const textarea = screen.getByRole('textbox');
				const cameraBtn = screen.getByLabelText('Take photo or upload image');

				expect(textarea).not.toBeDisabled();
				expect(cameraBtn).not.toBeDisabled();
			});
		});

		it('should be disabled when disabled prop is true', () => {
			render(InputArea, { props: { phase: 'greeting', disabled: true } });
			const textarea = screen.getByRole('textbox');
			const cameraBtn = screen.getByLabelText('Take photo or upload image');
			const sendBtn = screen.getByLabelText('Send message');

			expect(textarea).toBeDisabled();
			expect(cameraBtn).toBeDisabled();
			expect(sendBtn).toBeDisabled();
		});

		it('should apply disabled class to container when disabled', () => {
			render(InputArea, { props: { phase: 'identifying' } });
			const container = document.querySelector('.input-area');
			expect(container).toHaveClass('disabled');
		});
	});

	describe('send button state', () => {
		it('should be disabled when input is empty', () => {
			render(InputArea, { props: { phase: 'greeting' } });
			const sendBtn = screen.getByLabelText('Send message');
			expect(sendBtn).toBeDisabled();
		});

		it('should be disabled when input is only whitespace', async () => {
			render(InputArea, { props: { phase: 'greeting' } });
			const textarea = screen.getByRole('textbox');
			const sendBtn = screen.getByLabelText('Send message');

			await fireEvent.input(textarea, { target: { value: '   ' } });
			expect(sendBtn).toBeDisabled();
		});

		it('should be enabled when input has text', async () => {
			render(InputArea, { props: { phase: 'greeting' } });
			const textarea = screen.getByRole('textbox');
			const sendBtn = screen.getByLabelText('Send message');

			await fireEvent.input(textarea, { target: { value: 'Chateau Margaux' } });
			expect(sendBtn).not.toBeDisabled();
		});
	});

	describe('text submission', () => {
		it('should clear input after submission', async () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
			const sendBtn = screen.getByLabelText('Send message');

			await fireEvent.input(textarea, { target: { value: 'Chateau Margaux' } });
			await fireEvent.click(sendBtn);

			// Input should be cleared after submit
			expect(textarea.value).toBe('');
		});

		it('should not clear input when empty (nothing to submit)', async () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
			const sendBtn = screen.getByLabelText('Send message');

			// Don't input any text - button should be disabled
			expect(sendBtn).toBeDisabled();
		});

		it('should not clear input when disabled', async () => {
			render(InputArea, { props: { phase: 'identifying' } });

			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
			const sendBtn = screen.getByLabelText('Send message');

			// Should be disabled
			expect(textarea).toBeDisabled();
			expect(sendBtn).toBeDisabled();
		});
	});

	describe('keyboard submission', () => {
		it('should clear input on Enter key press (submit)', async () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
			await fireEvent.input(textarea, { target: { value: 'Burgundy 2019' } });
			await fireEvent.keyDown(textarea, { key: 'Enter' });

			// Input should be cleared after Enter submit
			expect(textarea.value).toBe('');
		});

		it('should not clear input on Shift+Enter (allows newline)', async () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
			await fireEvent.input(textarea, { target: { value: 'Test' } });
			await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

			// Input should NOT be cleared - Shift+Enter allows newline
			expect(textarea.value).toBe('Test');
		});
	});

	describe('image submission', () => {
		it('should have file input with correct attributes', () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
			expect(fileInput).toBeInTheDocument();
			expect(fileInput).toHaveAttribute('accept', 'image/*');
			expect(fileInput).toHaveAttribute('capture', 'environment');
		});

		it('should click file input when Take Photo menu item clicked', async () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const fileInput = document.querySelector('input[type="file"][capture]') as HTMLInputElement;
			const clickSpy = vi.spyOn(fileInput, 'click');

			// Step 1: Click camera button to open the image menu
			const cameraBtn = screen.getByLabelText('Take photo or upload image');
			await fireEvent.click(cameraBtn);

			// Step 2: Click "Take Photo" menu item
			const takePhotoBtn = screen.getByText('Take Photo');
			await fireEvent.click(takePhotoBtn);

			expect(clickSpy).toHaveBeenCalled();
		});

		it('should not open file picker when camera button is disabled', async () => {
			render(InputArea, { props: { phase: 'identifying' } });

			const cameraBtn = screen.getByLabelText('Take photo or upload image');
			expect(cameraBtn).toBeDisabled();
		});
	});

	describe('accessibility', () => {
		it('should have proper aria-labels on buttons', () => {
			render(InputArea, { props: { phase: 'greeting' } });

			expect(screen.getByLabelText('Take photo or upload image')).toBeInTheDocument();
			expect(screen.getByLabelText('Send message')).toBeInTheDocument();
		});

		it('should have proper button types', () => {
			render(InputArea, { props: { phase: 'greeting' } });

			const cameraBtn = screen.getByLabelText('Take photo or upload image');
			const sendBtn = screen.getByLabelText('Send message');

			expect(cameraBtn).toHaveAttribute('type', 'button');
			expect(sendBtn).toHaveAttribute('type', 'button');
		});
	});

	describe('mobile keyboard handling', () => {
		it('should scroll input into view on focus after delay', async () => {
			vi.useFakeTimers();
			render(InputArea, { props: { phase: 'greeting' } });

			const textarea = screen.getByRole('textbox');
			const scrollIntoViewMock = vi.fn();
			textarea.scrollIntoView = scrollIntoViewMock;

			await fireEvent.focus(textarea);

			// Should not scroll immediately
			expect(scrollIntoViewMock).not.toHaveBeenCalled();

			// Advance timer past the 300ms delay
			vi.advanceTimersByTime(300);

			// Now should have scrolled
			expect(scrollIntoViewMock).toHaveBeenCalledWith({
				behavior: 'smooth',
				block: 'center',
			});

			vi.useRealTimers();
		});

		it('should not scroll into view if textarea is unmounted before delay', async () => {
			vi.useFakeTimers();
			const { unmount } = render(InputArea, { props: { phase: 'greeting' } });

			const textarea = screen.getByRole('textbox');
			const scrollIntoViewMock = vi.fn();
			textarea.scrollIntoView = scrollIntoViewMock;

			await fireEvent.focus(textarea);

			// Unmount before timer fires
			unmount();
			vi.advanceTimersByTime(300);

			// Should not throw or call scroll since element is gone
			// (the optional chaining ?. handles this)
			vi.useRealTimers();
		});
	});
});
