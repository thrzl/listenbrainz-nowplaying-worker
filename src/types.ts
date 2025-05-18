export type ListenBrainzRes = {
	latest_listen_ts: number | undefined;
	listens: Array<{
		inserted_at: number;
		listened_at: number | null;
		recording_msid: string;
		track_metadata: {
			additional_info: {
				duration_ms: number;
				media_player: string;
				music_service: string;
				recording_mbid: string;
				submission_client: string;
				isrc: string;
			};
			artist_name: string;
			mbid_mapping: {
				artist_mbids: Array<string>;
				artists: Array<{
					artist_credit_name: string;
					artist_mbid: string;
					join_phrase: string;
				}>;
				caa_id: number;
				caa_release_mbid: string;
				recording_mbid: string;
				recording_name: string;
				release_mbid: string;
			};
			track_name: string;
			release_name: string;
		};
		user_name: string;
	}>;
	oldest_listen_ts: number;
	user_id: string;
};

export type ListenBrainzMetadata = {
	artist_credit_name: string;
	artist_mbids: Array<string>;
	recording_mbid: string;
	recording_name: string;
	release_mbid: string;
	release_name: string;
};

export type MusicBrainzRecordingSearch = {
	created: string;
	count: number;
	offset: number;
	recordings: Array<{
		id: string;
		title: string;
		length: number;
		"artist-credit": Array<{
			joinphrase?: string;
			name: string;
			artist: {
				id: string;
				name: string;
			};
		}>;
		releases: Array<{
			id: string;
			title: string;
			status: string;
			disambiguation: string | undefined;
			"artist-credit": Array<{
				name: string;
				artist: {
					id: string;
					name: string;
					"sort-name": string;
				};
			}>;
			"release-group": {
				id: string;
				"type-id": string;
				"primary-type-id": string;
				title: string;
				"primary-type": string;
			};
			date?: string;
			country?: string;
			"track-count": number;
			media: Array<{
				format: string;
				track: Array<{
					id: string;
					number: string;
					title: string;
					length: number;
				}>;
				"track-count": number;
				"track-offset": number;
			}>;
		}>;
		isrcs: Array<string>;
	}>;
};
