<?php
/**
 * Agent Match Clarification Endpoint
 *
 * Uses LLM to help users decide between multiple matching options
 * (regions, producers, or wines) during the add wine flow.
 *
 * @package Agent
 */

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/LLM/LLMClient.php';

agentRequireMethod('POST');
$body = agentGetJsonBody();
agentRequireFields($body, ['type', 'identified', 'options']);

// Validate type
$allowedTypes = ['region', 'producer', 'wine'];
if (!in_array($body['type'], $allowedTypes)) {
    agentError('Invalid type. Must be: ' . implode(', ', $allowedTypes));
}

// Validate options non-empty and limit size
if (!is_array($body['options']) || empty($body['options'])) {
    agentError('At least one option required for clarification');
}
$options = array_slice($body['options'], 0, 10); // Limit to 10

// Validate identified has required fields
$identified = $body['identified'];
if (empty($identified['producer']) && empty($identified['wineName'])) {
    agentError('Identified wine must have producer or wine name');
}

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();
    $client = getAgentLLMClient($userId);

    // Build options list with metadata
    $optionsList = array_map(function($opt, $idx) {
        $parts = [($idx + 1) . ". " . $opt['name']];
        if (!empty($opt['meta'])) {
            $parts[] = "({$opt['meta']})";
        }
        if (!empty($opt['bottleCount'])) {
            $parts[] = "[{$opt['bottleCount']} bottles in cellar]";
        }
        return implode(' ', $parts);
    }, $options, array_keys($options));

    // Safe field access
    $producer = $identified['producer'] ?? 'Unknown Producer';
    $wineName = $identified['wineName'] ?? 'Unknown Wine';
    $vintage = $identified['vintage'] ?? 'NV';
    $region = $identified['region'] ?? 'Unknown Region';

    $prompt = "You are an expert sommelier helping a wine collector.

The user is trying to add: {$producer} - {$wineName} ({$vintage})
Region: {$region}

I found these existing {$body['type']} entries in their collection:
" . implode("\n", $optionsList) . "

Task: In 1-2 sentences, explain which option best matches what they're adding, or if they should create a new entry. Be concise and complete your thought.";

    $result = $client->complete('clarify_match', $prompt, ['max_tokens' => 500]);

    // Check LLM response success
    if (!$result->success) {
        agentStructuredError('clarification_error', $result->error ?? 'Could not generate clarification');
    }

    // Validate non-empty response
    $explanation = trim($result->content ?? '');
    if (empty($explanation)) {
        agentStructuredError('clarification_error', 'Empty response from sommelier');
    }

    agentResponse(true, 'Clarification', ['explanation' => $explanation]);

} catch (Exception $e) {
    agentExceptionError($e, 'clarifyMatch');
}
