import type { MusicBrainzRecordingSearch, ListenBrainzRes } from "./types";

async function niceFetch(url: string, noCache = false) {
  const cache = caches.default;
  const request = new Request(url);
  const shouldCache = !(noCache || url.includes("api.listenbrainz.org"));
  if (shouldCache) {
    const hit = await cache.match(request);
    if (!hit) {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "listenbrainz-np-meta-enhancer/1.0 github.com/thrzl/workers",
        },
      });
      if (res.ok) {
        await cache.put(request, res.clone());
      }
      return res;
    }
    return hit;
  }
  return await fetch(url, {
    headers: {
      "User-Agent":
        "listenbrainz-np-meta-enhancer/1.0 github.com/thrzl/workers",
    },
  });
}

async function sha256(message: string) {
  // encode as UTF-8
  const msgBuffer = await new TextEncoder().encode(message);
  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  // convert bytes to hex string
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type Track = {
  release: {
    mbid: string;
    name: string;
  };
  artists: {
    name: string;
    join_phrase: string;
    mbid: string;
  }[];
  name: string;
  mbid: string;
  matched: boolean;
};

async function getNowPlaying(user: string) {
  const res = await niceFetch(
    `https://api.listenbrainz.org/1/user/${user}/playing-now`,
  );
  if (!res.ok) {
    console.error(`https://api.listenbrainz.org/1/user/${user}/playing-now`);
    console.error(res.status, res.statusText);
    throw new Error("Network response was not ok");
  }
  const nowPlaying: { payload: ListenBrainzRes } = await res.json();
  return nowPlaying.payload;
}

async function musicBrainzSearch(
  track: ListenBrainzRes["listens"][0]["track_metadata"],
): Promise<Track> {
  console.debug("looking up", track.track_name)
  const cachedResponse = await caches.default.match(
    new Request(`https://lstnbrnz.thrzl.xyz/${await sha256(JSON.stringify(track))}`),
  );
  if (cachedResponse) {
    console.debug("found in cache!")
    return cachedResponse.json();
  }
  const cleaned_release_name = track.release_name
    .replace(/\s*-\s*[^-]+$/, "") // remove '- EP', '- Single', etc.
    .replace(/\s*\(feat\. [^)]+\)/i, ""); // remove '(feat. ...)'

  // musicbrainz api search for recording with the same isrc OR with the same track, release, and artist name
  const query = track.additional_info?.isrc
    ? `isrc:${track.additional_info.isrc} OR (recording:"${track.track_name.replace(/\s*\(feat\. [^)]+\)/i, "")}" AND artist:"${track.artist_name}" AND release:"${cleaned_release_name}")`
    : `recording:"${track.track_name.replace(/\s*\(feat\. [^)]+\)/i, "")}" AND artist:"${track.artist_name}" AND release:"${cleaned_release_name}"`;
  const rawTrackMetadata = await niceFetch(
    `https://musicbrainz.org/ws/2/recording?fmt=json&query=${query}`,
  );

  const copOut = {
    name: track.track_name,
    mbid: "",
    artists: [
      {
        name: track.artist_name,
        mbid: "",
        join_phrase: "",
      },
    ],
    release: {
      mbid: "",
      name: "",
    },
    matched: false,
  };

  if (!rawTrackMetadata.ok) {
    console.error("failed to fetch metadata lookup for now playing recording");
    console.error(rawTrackMetadata.status, rawTrackMetadata.statusText);
    return copOut;
  }
  const trackMetadata: MusicBrainzRecordingSearch =
    await rawTrackMetadata.json();

  const matchedRecording =
    trackMetadata.recordings.find((recording) =>
      recording.isrcs?.includes(track.additional_info.isrc),
    ) || trackMetadata.recordings[0];

  const matchedRelease =
    matchedRecording?.releases.find(
      (release) =>
        release["artist-credit"]
          ?.map((credit) => credit.artist.id)
          .includes(matchedRecording["artist-credit"][0].artist.id) &&
        release.media[0].format === "Digital Media",
    ) || matchedRecording?.releases[0];

  if (!matchedRelease || !matchedRecording) {
    return copOut
  }

  if (
    matchedRelease?.title.toLowerCase() !==
    cleaned_release_name.toLowerCase() && // check for same title
    (!track.additional_info.isrc
      ? !matchedRecording?.isrcs?.includes(track.additional_info.isrc)
      : false)
  ) {
    console.error("no valid media found for the current track! :(");
    return copOut;
  }
  const resBody = {
    release: {
      name: matchedRelease.title,
      mbid: matchedRelease.id,
    },
    artists: matchedRecording["artist-credit"].map((credit) => ({
      name: credit.name,
      mbid: credit.artist.id,
      join_phrase: credit.joinphrase || " · ",
    })),
    name: matchedRecording.title,
    mbid: matchedRecording.id,
    matched: true,
  };
  await caches.default.put(
    new Request(`https://lstnbrnz.thrzl.xyz/${await sha256(JSON.stringify(track))}`),
    new Response(JSON.stringify(resBody)),
  );
  return resBody;
}

async function getLastListen(user: string) {
  const res = await niceFetch(
    `https://api.listenbrainz.org/1/user/${user}/listens?count=1`,
  );
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  const lastListen: { payload: ListenBrainzRes } = await res.json();
  return lastListen.payload;
}

export default async function getRecentTrack(user: string): Promise<Track> {
  const nowPlaying = (await getNowPlaying(user)).listens[0];
  if (nowPlaying) {
    // if the track has an mbid, meaning it was found in the database
    if (nowPlaying?.track_metadata.additional_info.recording_mbid) {
      const data = nowPlaying.track_metadata;
      const rawData = await niceFetch(
        `https://musicbrainz.org/ws/2/recording?fmt=json&query=rid:${data.additional_info.recording_mbid} AND release:(${data.release_name})`,
      );
      const trackMetadata: MusicBrainzRecordingSearch = await rawData.json();
      const track = trackMetadata.recordings[0];

      const release =
        track.releases.filter((release) => {
          return (
            release.title === data.release_name &&
            release.media[0].format === "Digital Media"
          );
        })[0] ||
        track.releases.filter((release) => {
          return release.media[0].format === "Digital Media";
        })[0] ||
        track.releases[0];
      return {
        name: track.title,
        mbid: track.id,
        release: {
          mbid: release.id,
          name: release.title,
        },
        artists: track["artist-credit"].map((credit, i) => ({
          name: credit.name,
          mbid: credit.artist.id,
          join_phrase: credit.joinphrase || " · ",
        })),
        matched: true,
      };
    }
    return await musicBrainzSearch(nowPlaying.track_metadata);
  }

  const recentTrackData = await getLastListen(user);
  const track = recentTrackData.listens[0].track_metadata;
  if (track.mbid_mapping.recording_mbid) {
    console.debug("listenbrainz data is rich!")
    return {
      name: track.track_name,
      mbid: track.mbid_mapping.recording_mbid,
      release: {
        mbid: track.mbid_mapping.release_mbid,
        name: track.release_name,
      },
      artists: track.mbid_mapping.artists.map((credit, i) => ({
        name: credit.artist_credit_name,
        mbid: credit.artist_mbid,
        join_phrase: credit.join_phrase || " · ",
      })),
      matched: true,
    };
  }

  return await musicBrainzSearch(track);
}
