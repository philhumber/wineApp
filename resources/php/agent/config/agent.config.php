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
                'gemini-2.0-flash' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                ],
                'gemini-2.0-flash-lite' => [
                    'max_tokens' => 8192,
                    'supports_vision' => false,
                    'supports_tools' => true,
                ],
            ],
            'timeout' => 30,
        ],
        'claude' => [
            'enabled' => false, // Enable when API key available
            'api_key_env' => 'ANTHROPIC_API_KEY',
            'base_url' => 'https://api.anthropic.com/v1',
            'default_model' => 'claude-sonnet-4-20250514',
            'models' => [
                'claude-sonnet-4-20250514' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                ],
                'claude-haiku-4-20250514' => [
                    'max_tokens' => 8192,
                    'supports_vision' => true,
                    'supports_tools' => true,
                ],
            ],
            'timeout' => 30,
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
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-2.0-flash'],
            'fallback' => ['provider' => 'claude', 'model' => 'claude-haiku-4-20250514'],
        ],
        'identify_image' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-2.0-flash'],
            'fallback' => ['provider' => 'claude', 'model' => 'claude-sonnet-4-20250514'],
        ],
        'enrich' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-2.0-flash'],
            'fallback' => null,
        ],
        'pair' => [
            'primary' => ['provider' => 'gemini', 'model' => 'gemini-2.0-flash'],
            'fallback' => ['provider' => 'claude', 'model' => 'claude-sonnet-4-20250514'],
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
        'gemini-2.0-flash' => ['input' => 0.10, 'output' => 0.40],
        'gemini-2.0-flash-lite' => ['input' => 0.075, 'output' => 0.30],
        'claude-sonnet-4-20250514' => ['input' => 3.00, 'output' => 15.00],
        'claude-haiku-4-20250514' => ['input' => 0.80, 'output' => 4.00],
        'text-embedding-3-small' => ['input' => 0.02, 'output' => 0.00],
    ],

    // ===========================================
    // Rate Limits & Budgets
    // ===========================================
    'limits' => [
        'daily_requests' => 100,
        'daily_cost_usd' => 5.00,
        'requests_per_minute' => 10,
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
    // Confidence Thresholds
    // ===========================================
    'confidence' => [
        'auto_populate' => 85,     // ≥85%: Fill form automatically
        'suggest' => 60,           // 60-84%: Show suggestion
        'disambiguate' => 0,       // <60%: Show multiple options
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
    // Session Settings
    // ===========================================
    'session' => [
        'ttl_hours' => 24,
        'max_context_items' => 10,
        'cleanup_interval' => 3600, // Run cleanup every hour
    ],
];
