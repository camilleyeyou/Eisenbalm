/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentVotes from "../agentVotes.js";
import type * as crons from "../crons.js";
import type * as deliberationEvents from "../deliberationEvents.js";
import type * as emailActions from "../emailActions.js";
import type * as emailFlow from "../emailFlow.js";
import type * as emailSends from "../emailSends.js";
import type * as emailSubscribers from "../emailSubscribers.js";
import type * as pipelineRuns from "../pipelineRuns.js";
import type * as pitchLog from "../pitchLog.js";
import type * as qaCorrections from "../qaCorrections.js";
import type * as stripeEvents from "../stripeEvents.js";
import type * as stripeOrders from "../stripeOrders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentVotes: typeof agentVotes;
  crons: typeof crons;
  deliberationEvents: typeof deliberationEvents;
  emailActions: typeof emailActions;
  emailFlow: typeof emailFlow;
  emailSends: typeof emailSends;
  emailSubscribers: typeof emailSubscribers;
  pipelineRuns: typeof pipelineRuns;
  pitchLog: typeof pitchLog;
  qaCorrections: typeof qaCorrections;
  stripeEvents: typeof stripeEvents;
  stripeOrders: typeof stripeOrders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
