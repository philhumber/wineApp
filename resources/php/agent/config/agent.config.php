<?php
/**
 * AI Agent Configuration
 *
 * This file contains all configuration for the AI Wine Sommelier agent.
 *
 * @package Agent
 */

return [
    // ===========================================
    // Provider Configuration
    // ===========================================
    'providers' => [
        'gemini' => [
            'enabled' => true,
            'api_key_env' => 'GEMINI_API_KEY',
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
            'default_model' => 'gemini-2.0-flash',
            'models' => [
                'gemini-3-flash-preview' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                    'supports_thinking' => true,
                    'supports_grounding' => true,
                ],
                'gemini-3-pro-preview' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                    'supports_thinking' => true,
                    'supports_grounding' => true,
                ],
                'gemini-2.0-flash' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                    'supports_thinking' => false,
                ],
                'gemini-1.5-flash' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                    'supports_thinking' => false,
                ],
            ],
            'timeout' => 30,
        ],
        'claude' => [
            'enabled' => true, // Enabled for multi-tier escalation
            'api_key_env' => 'ANTHROPIC_API_KEY',
            'base_url' => 'https://api.anthropic.com/v1',
            'default_model' => 'claude-sonnet-4-5-20250929',
            'models' => [
                'claude-sonnet-4-5-20250929' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                ],
                'claude-opus-4-5-20251101' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                ],
            ],
            'timeout' => 60, // Longer timeout for Opus
        ],
        'openai' => [
            'enabled' => false, // Enable when API key available
            'api_key_env' => 'OPENAI_API_KEY',
            'base_url' => 'https://api.openai.com/v1',
            'embedding_model' => 'text-embedding-3-small',
            'embedding_dimensions' => 1536,
            'timeout' => 30,
        ],
    ],

    // ===========================================
    // Task Routing
    // ===========================================
    'task_routing' => [
        'identify_text' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-3-flash-preview'],
            'fallback' => ['provider' => 'claude', 'model' => 'claude-sonnet-4-5-20250929'],
        ],
        'identify_image' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-3-flash-preview'],
            'fallback' => ['provider' => 'claude', 'model' => 'claude-sonnet-4-5-20250929'],
        ],
        'enrich' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-3-pro-preview'],
            'fallback' => null,  // Enrichment is optional - graceful degradation
            'timeout' => 60,     // Longer timeout for web search
        ],
        'pair' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-3-flash-preview'],
            'fallback' => ['provider' => 'claude', 'model' => 'claude-sonnet-4-5-20250929'],
        ],
        'embed' => [
            'primary' => ['provider' => 'openai', 'model' => 'text-embedding-3-small'],
            'fallback' => null, // Embeddings must be consistent - no fallback
        ],
    ],

    // ===========================================
    // Cost Tracking (per million tokens)
    // ===========================================
    'costs_per_million' => [
        'gemini-3-flash-preview' => ['input' => 0.15, 'output' => 0.60],
        'gemini-3-pro-preview' => ['input' => 1.25, 'output' => 5.00],
        'gemini-2.0-flash' => ['input' => 0.10, 'output' => 0.40],
        'gemini-1.5-flash' => ['input' => 0.075, 'output' => 0.30],
        'claude-sonnet-4-5-20250929' => ['input' => 3.00, 'output' => 15.00],
        'claude-opus-4-5-20251101' => ['input' => 5.00, 'output' => 25.00],
        'text-embedding-3-small' => ['input' => 0.02, 'output' => 0.00],
    ],

    // ===========================================
    // Rate Limits & Budgets
    // ===========================================
    'limits' => [
        'daily_requests' => 500,      // Increased for dev
        'daily_cost_usd' => 25.00,    // Increased for dev
        'requests_per_minute' => 30,  // Increased for dev
        'max_input_tokens' => 4000,
        'max_output_tokens' => 2000,
    ],

    // ===========================================
    // Circuit Breaker Settings
    // ===========================================
    'circuit_breaker' => [
        'failure_threshold' => 5,      // Failures before opening
        'recovery_timeout' => 60,      // Seconds before half-open
        'success_threshold' => 2,      // Successes to close from half-open
        'sample_window' => 120,        // Seconds to track failures
    ],

    // ===========================================
    // Retry Settings
    // ===========================================
    'retry' => [
        'max_attempts' => 3,
        'base_delay_ms' => 1000,
        'max_delay_ms' => 10000,
        'jitter' => true,
        'retryable_errors' => [
            'rate_limit',
            'timeout',
            'server_error',
            'overloaded',
        ],
    ],

    // ===========================================
    // Model Tiers (for smart escalation)
    // ===========================================
    // NOTE: Gemini 3 thinking mode consumes tokens from maxOutputTokens budget.
    // Tier 1 uses LOW thinking for speed; Tier 1.5 uses HIGH thinking with
    // larger token budget. If confidence < 60%, always offer premium model.
    'model_tiers' => [
        'fast' => [
            'provider' => 'gemini',
            'model' => 'gemini-3-flash-preview',
            'thinking_level' => 'LOW', // Low thinking for quick responses
            'description' => 'Quick identification - Tier 1',
            'temperature' => 1.0,
            'max_tokens' => 4000, // Higher to accommodate thinking tokens
        ],
        'detailed' => [
            'provider' => 'gemini',
            'model' => 'gemini-3-flash-preview',
            'thinking_level' => 'HIGH', // Must be uppercase: LOW or HIGH
            'description' => 'Deep analysis with thinking - Tier 1.5',
            'temperature' => 1.0,
            'max_tokens' => 16000, // High for thinking + JSON output
        ],
        'balanced' => [
            'provider' => 'claude',
            'model' => 'claude-sonnet-4-5-20250929',
            'description' => 'Cross-provider escalation - Tier 2',
            'temperature' => 0.3,
            'max_tokens' => 800,
        ],
        'premium' => [
            'provider' => 'claude',
            'model' => 'claude-opus-4-5-20251101',
            'description' => 'User-triggered premium - Tier 3',
            'temperature' => 0.3,
            'max_tokens' => 1000,
        ],
    ],

    // ===========================================
    // Confidence Thresholds
    // ===========================================
    'confidence' => [
        'auto_populate' => 85,       // ≥85%: Fill form automatically (Tier 1 success)
        'suggest' => 60,             // 60-84%: Show suggestion
        'disambiguate' => 0,         // <50%: Show multiple options or conversational
        'tier1_threshold' => 85,     // Tier 1 early return threshold
        'tier1_5_threshold' => 70,   // Tier 1.5 early return threshold
        'tier2_threshold' => 60,     // Tier 2 early return threshold
        'user_choice_threshold' => 60, // If <60%, always offer premium model
        'escalation_threshold' => 70,  // Legacy - when to try detailed model
        'weights' => [
            'producer' => 0.30,
            'wine_name' => 0.20,
            'vintage' => 0.15,
            'region' => 0.15,
            'grape' => 0.10,
            'type' => 0.10,
        ],
    ],

    // ===========================================
    // Cache TTLs (in days)
    // ===========================================
    'cache_ttl' => [
        'static' => 365,           // Founded year, country, grape varieties
        'semi_static' => 90,       // Winemaker, description, drink window
        'dynamic' => 30,           // Critic scores, tasting notes
        'price' => 7,              // Market prices
    ],

    // ===========================================
    // Enrichment Settings (Phase 2.5)
    // ===========================================
    'enrichment' => [
        'enabled' => true,
        'cache_ttl_days' => [
            'static' => 365,       // grapes, appellation, ABV
            'semi_static' => 90,   // drink window, production method, style
            'dynamic' => 30,       // critic scores, price
        ],
        'confidence_thresholds' => [
            'cache_accept' => 0.6,     // Use cached data without refresh
            'store_minimum' => 0.4,    // Minimum confidence to cache
            'merge_threshold' => 0.5,  // Below this, merge with cache/inference
        ],
        'validation' => [
            'abv_min' => 5,
            'abv_max_standard' => 17,   // Accommodates Zinfandel, Amarone, Shiraz
            'abv_max_fortified' => 26,
            'critic_score_min' => 50,
            'critic_score_max' => 100,
            'grape_percentage_tolerance' => 5,  // Allow 95-105%
        ],
        'fortified_types' => ['Fortified', 'Port', 'Sherry', 'Madeira', 'Marsala'],
    ],

    // ===========================================
    // Session Settings
    // ===========================================
    'session' => [
        'ttl_hours' => 24,
        'max_context_items' => 10,
        'cleanup_interval' => 3600, // Run cleanup every hour
    ],
];
