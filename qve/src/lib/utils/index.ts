/**
 * Utilities Module
 * Pure helper functions used across the application
 */

// UUID
export { generateUUID } from './uuid';

// Command Detection
export {
	detectCommand,
	detectChipResponse,
	isBriefInput,
	type CommandType,
	type CommandDetectionResult,
	type ChipResponseType,
	type ChipResponseDetectionResult
} from './commandDetector';

// Error Reporting
export { reportError, type ErrorReport } from './errorReporter';
