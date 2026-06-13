import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { deepseek, type DeepSeekLanguageModelOptions } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
    findSupportedChatModel,
    type SupportedChatModel,
    type SupportedChatModelId,
    type SupportedProvider,
} from '@atomcode/shared';

import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { LanguageModel } from "ai";


function getOpenAICompatibleModels() {
    const apiKey = process.env.MODEL_API_KEY;
    if (!apiKey) {
        throw new Error('MODEL_API_KEY environment variable is required for openai-compatible provider');
    }

    const baseURL = process.env.MODEL_API_BASE;
    if (!baseURL) {
        throw new Error('MODEL_API_BASE environment variable is required for openai-compatible provider');
    }

    return createOpenAICompatible({
        name: 'silicon',
        apiKey,
        baseURL,
        includeUsage: true,
    });
}



type AnthropicModelId = Extract<SupportedChatModel, { provider: "anthropic" }>["id"];
type OpenAIModelId = Extract<SupportedChatModel, { provider: "openai" }>["id"];
type DeepseekModelId = Extract<SupportedChatModel, { provider: "deepseek" }>["id"];
type OpenAICompatibleModelId = Extract<SupportedChatModel, { provider: "openai-compatible" }>["id"];

export type ResolvedModel = {
    model: LanguageModel;
    provider: SupportedProvider;
    modelId: SupportedChatModelId;
    providerOptions?: ProviderOptions;
};

const ANTHROPIC_PROVIDER_OPTIONS: Partial<Record<AnthropicModelId, ProviderOptions>> = {
    "claude-opus-4.6": {
        anthropic: {
            thinking: { type: 'enabled', budgetTokens: 8000 },
            effort: 'medium',
        } satisfies AnthropicLanguageModelOptions,
    },
    "claude-sonnet-4.6": {
        anthropic: {
            thinking: { type: 'enabled', budgetTokens: 8000 },
            effort: 'medium',
        } satisfies AnthropicLanguageModelOptions,
    },
};
const OPENAI_PROVIDER_OPTIONS: Partial<Record<OpenAIModelId, ProviderOptions>> = {
    "gpt-5.4": {
        openai: {
            reasoningEffort: 'high',
            reasoningSummary: 'detailed',
        } satisfies OpenAILanguageModelResponsesOptions,
    },
};

const DEEPSEEK_PROVIDER_OPTIONS: Partial<Record<DeepseekModelId, ProviderOptions>> = {
    "deepseek-v4-pro": {
        deepseek: {
            thinking: { type: 'enabled' },
            reasoningEffort: 'high',
        } satisfies DeepSeekLanguageModelOptions,
    },
    "deepseek-v4-flash": {
        deepseek: {
            thinking: { type: 'enabled' },
            reasoningEffort: 'medium',
        } satisfies DeepSeekLanguageModelOptions,
    },
};

const OPENAI_COMPATIBLE_PROVIDER_OPTIONS: Partial<Record<OpenAICompatibleModelId, ProviderOptions>> = {
    "nex-agi/Nex-N2-Pro": {
        openai: {
            reasoningEffort: 'high',
            reasoningSummary: 'detailed',
        } satisfies OpenAILanguageModelResponsesOptions,
    },
    "Qwen/Qwen3.5-27B": {
        openai: {
            reasoningEffort: 'high',
            reasoningSummary: 'detailed',
        } satisfies OpenAILanguageModelResponsesOptions,
    },
};

//确保 provider 是support的
function assertUnsupportedProvider(provider: never): never {
    throw new Error(`Unsupported provider: ${provider}`);
};

//解析 anthropropic 模型
function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
    return {
        model: anthropic(modelId),
        provider: "anthropic",
        modelId,
        providerOptions: ANTHROPIC_PROVIDER_OPTIONS[modelId],
    };
};

//解析 openai 模型
function resolveOpenAIModel(modelId: OpenAIModelId): ResolvedModel {
    return {
        model: openai(modelId),
        provider: "openai",
        modelId,
        providerOptions: OPENAI_PROVIDER_OPTIONS[modelId],
    };
};

function resolveDeepseekModel(modelId: DeepseekModelId): ResolvedModel {
    return {
        model: deepseek(modelId),
        provider: "deepseek",
        modelId,
        providerOptions: DEEPSEEK_PROVIDER_OPTIONS[modelId],
    };
}

function resolveOpenAICompatibleModel(modelId: OpenAICompatibleModelId): ResolvedModel {
    return {
        model: getOpenAICompatibleModels()(modelId),
        provider: 'openai-compatible',
        modelId,
        providerOptions: OPENAI_COMPATIBLE_PROVIDER_OPTIONS[modelId],
    };
}



function resolveSupportedChatModel(model: SupportedChatModel): ResolvedModel {
    const provider = model.provider;

    switch (provider) {
        case "anthropic":
            return resolveAnthropicModel(model.id);
        case "openai":
            return resolveOpenAIModel(model.id);
        case "deepseek":
            return resolveDeepseekModel(model.id);
        case "openai-compatible":
            return resolveOpenAICompatibleModel(model.id);
        default:
            return assertUnsupportedProvider(provider);
    }
};

export function isSupportedChatModel(modelId: string): modelId is SupportedChatModelId {
    return findSupportedChatModel(modelId) != null;
};

export function resolveChatModel(modelId: string): ResolvedModel {
    const model = findSupportedChatModel(modelId);
    if (!model) {
        throw new Error(`不支持模型: ${modelId}`);
    }

    return resolveSupportedChatModel(model);
};