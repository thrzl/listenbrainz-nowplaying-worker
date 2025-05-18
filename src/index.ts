/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import getRecentTrack from "./lib";

export default {
	async fetch(
		request: Request<unknown, IncomingRequestCfProperties<unknown>>,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const { searchParams } = new URL(request.url);

		const user = searchParams.get("user");
		if (!user) {
			return Response.json(
				{ error: "no user param specified" },
				{
					status: 400,
					statusText: "no user param specified",
					headers: {
						"Access-Control-Allow-Origin": "*",
					},
				},
			);
		}

		const recentTrackData = await getRecentTrack(user);
		return Response.json(recentTrackData, {
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		});
	},
} satisfies ExportedHandler<Env>;
