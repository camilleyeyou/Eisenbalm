/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentRuns from "../agentRuns.js";
import type * as agentVotes from "../agentVotes.js";
import type * as agents from "../agents.js";
import type * as auditLog from "../auditLog.js";
import type * as charities from "../charities.js";
import type * as charityLedger from "../charityLedger.js";
import type * as claimChecks from "../claimChecks.js";
import type * as crons from "../crons.js";
import type * as deliberationEvents from "../deliberationEvents.js";
import type * as emailActions from "../emailActions.js";
import type * as emailFlow from "../emailFlow.js";
import type * as emailSends from "../emailSends.js";
import type * as emailSubscribers from "../emailSubscribers.js";
import type * as pipelineConfig from "../pipelineConfig.js";
import type * as pipelineRuns from "../pipelineRuns.js";
import type * as pitchLog from "../pitchLog.js";
import type * as promptVersions from "../promptVersions.js";
import type * as qaCorrections from "../qaCorrections.js";
import type * as reviewActions from "../reviewActions.js";
import type * as runs from "../runs.js";
import type * as stripeEvents from "../stripeEvents.js";
import type * as stripeOrders from "../stripeOrders.js";
import type * as users from "../users.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentRuns: typeof agentRuns;
  agentVotes: typeof agentVotes;
  agents: typeof agents;
  auditLog: typeof auditLog;
  charities: typeof charities;
  charityLedger: typeof charityLedger;
  claimChecks: typeof claimChecks;
  crons: typeof crons;
  deliberationEvents: typeof deliberationEvents;
  emailActions: typeof emailActions;
  emailFlow: typeof emailFlow;
  emailSends: typeof emailSends;
  emailSubscribers: typeof emailSubscribers;
  pipelineConfig: typeof pipelineConfig;
  pipelineRuns: typeof pipelineRuns;
  pitchLog: typeof pitchLog;
  promptVersions: typeof promptVersions;
  qaCorrections: typeof qaCorrections;
  reviewActions: typeof reviewActions;
  runs: typeof runs;
  stripeEvents: typeof stripeEvents;
  stripeOrders: typeof stripeOrders;
  users: typeof users;
  workspace: typeof workspace;
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
