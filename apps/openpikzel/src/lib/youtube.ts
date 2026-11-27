import {AppError} from './validation';
export type Channel={id:string;name:string;avatar:string;subscribers:number|null;videos:number|null};
export type ChannelVideo={id:string;title:string;thumbnail:string;views:number;duration:string;publishedAt:string};
export function channelIdentifier(raw:string):{id?:string;forHandle?:string;forUsername?:string}{
 let value=raw.trim();if(value.length>300)throw new AppError(400,'Enter a YouTube channel URL, handle or channel ID.');
 if(/^https?:\/\//i.test(value)){let u:URL;try{u=new URL(value);}catch{throw new AppError(400,'Check the channel URL.');}
 if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)||u.username||u.password)throw new AppError(400,'Use an official HTTPS YouTube channel URL.');
 const parts=u.pathname.split('/').filter(Boolean);if(parts[0]==='channel'&&/^UC[\w-]{22}$/.test(parts[1]||''))return {id:parts[1]};
 if(parts[0]==='user'&&/^[\w.-]{1,100}$/.test(parts[1]||''))return {forUsername:parts[1]};
 if(parts[0]?.startsWith('@'))value=parts[0];else throw new AppError(400,'Use the channel handle or /channel/ URL, not a video link.');
 }
 if(/^UC[\w-]{22}$/.test(value))return {id:value};
 if(/^@?[\p{L}\p{N}_.-]{1,100}$/u.test(value))return {forHandle:value.startsWith('@')?value:'@'+value};
 throw new AppError(400,'Enter a channel handle such as @creator.');
}
export function formatDuration(value:string){const m=typeof value==='string'&&value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);if(!m)return '';const h=Number(m[1]||0),min=Number(m[2]||0),s=Number(m[3]||0);return h?h+':'+String(min).padStart(2,'0')+':'+String(s).padStart(2,'0'):min+':'+String(s).padStart(2,'0');}
export function videoCards(payload:any):ChannelVideo[]{return (Array.isArray(payload?.items)?payload.items:[]).filter((v:any)=>v&&/^[\w-]{11}$/.test(v.id||'')&&typeof v.snippet?.title==='string').map((v:any)=>({id:v.id,title:v.snippet.title,thumbnail:'https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg',views:Number(v.statistics?.viewCount)||0,duration:formatDuration(v.contentDetails?.duration),publishedAt:v.snippet.publishedAt||''}));}
export async function youtubeRead(key:string,path:string,params:Record<string,string>,fetcher:typeof fetch=fetch){
 const url=new URL('https://www.googleapis.com/youtube/v3/'+path);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
 const r=await fetcher(url,{headers:{'X-Goog-Api-Key':key},signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
 if(!r.ok)throw new AppError(r.status===403?403:502,r.status===403?'Enable YouTube Data API v3 for your own YouTube key and check its restrictions or quota in Google Cloud.':'YouTube did not return this channel. Check the handle and try again.');
 return r.json();
}
export async function channelVideos(key:string,identifier:string,order:'recent'|'popular',pageToken='',fetcher:typeof fetch=fetch){
 const channels=await youtubeRead(key,'channels',{part:'snippet,statistics',...channelIdentifier(identifier)},fetcher),c=channels.items?.[0];
 if(!c||!/^UC[\w-]{22}$/.test(c.id||''))throw new AppError(404,'No channel found. Try its @handle or /channel/ URL.');
 const results=await youtubeRead(key,'search',{part:'snippet',channelId:c.id,type:'video',order:order==='popular'?'viewCount':'date',maxResults:'12',...(pageToken?{pageToken}:{} )},fetcher);
 const ids:string[]=(Array.isArray(results.items)?results.items:[]).map((x:any)=>x.id?.videoId).filter((id:any)=>typeof id==='string'&&/^[\w-]{11}$/.test(id));
 const videos=ids.length?videoCards(await youtubeRead(key,'videos',{part:'snippet,statistics,contentDetails',id:ids.join(',')},fetcher)):[];
 const byId=new Map(videos.map(v=>[v.id,v]));
 const avatar=c.snippet?.thumbnails?.default?.url||'',safeAvatar=/^https:\/\/yt3\.(?:ggpht\.com|googleusercontent\.com)\//.test(avatar)?avatar:'';
 return {channel:{id:c.id,name:c.snippet?.title||c.id,avatar:safeAvatar,subscribers:c.statistics?.hiddenSubscriberCount?null:Number(c.statistics?.subscriberCount)||0,videos:Number(c.statistics?.videoCount)||0} satisfies Channel,videos:ids.map((id:string)=>byId.get(id)).filter(Boolean),nextPageToken:results.nextPageToken||null,notice:'Public channel data from YouTube. Selecting references does not grant rights to reuse their contents.'};
}


export type IngestedChannelVideo = {
  youtubeVideoId: string;
  title: string;
  description: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  durationSec: number;
  publishedAt: string | null;
  outlierRatio: number;
  thumbnailUrl: string;
};

export function parseIsoDurationSec(value: string): number {
  const m =
    typeof value === "string" &&
    value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/**
 * Quota-smart channel ingestion: uses uploads playlist (1 unit) + videos.list (1 unit)
 * instead of search.list (100 units), computing median views and outlier ratios.
 */
export async function ingestChannelSnapshot(
  key: string,
  identifier: string,
  maxVideos = 40,
  fetcher: typeof fetch = fetch,
) {
  const channels = await youtubeRead(
    key,
    "channels",
    {
      part: "snippet,statistics,contentDetails",
      ...channelIdentifier(identifier),
    },
    fetcher,
  );
  const c = channels.items?.[0];
  if (!c || !/^UC[\w-]{22}$/.test(c.id || "")) {
    throw new AppError(
      404,
      "No YouTube channel found. Try its @handle or /channel/ URL.",
    );
  }
  const uploadsPlaylistId: string | undefined =
    c.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new AppError(404, "This channel has no public uploads playlist.");
  }

  const playlist = await youtubeRead(
    key,
    "playlistItems",
    {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, Math.max(10, maxVideos))),
    },
    fetcher,
  );
  const videoIds: string[] = (
    Array.isArray(playlist.items) ? playlist.items : []
  )
    .map((item: { contentDetails?: { videoId?: string } }) =>
      item?.contentDetails?.videoId,
    )
    .filter((id: unknown): id is string =>
      typeof id === "string" && /^[\w-]{11}$/.test(id),
    );

  const detailsPayload = videoIds.length
    ? await youtubeRead(
        key,
        "videos",
        {
          part: "snippet,statistics,contentDetails",
          id: videoIds.join(","),
        },
        fetcher,
      )
    : { items: [] };

  const rawVideos = (
    Array.isArray(detailsPayload.items) ? detailsPayload.items : []
  )
    .filter(
      (v: { id?: string; snippet?: { title?: string } }) =>
        v && /^[\w-]{11}$/.test(v.id || "") && typeof v.snippet?.title === "string",
    )
    .map(
      (v: {
        id: string;
        snippet: {
          title: string;
          description?: string;
          publishedAt?: string;
          defaultAudioLanguage?: string;
          defaultLanguage?: string;
        };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
        contentDetails?: { duration?: string };
      }) => ({
        youtubeVideoId: v.id,
        title: v.snippet.title,
        description: (v.snippet.description || "").slice(0, 1800),
        viewCount: Number(v.statistics?.viewCount) || 0,
        likeCount:
          v.statistics?.likeCount !== undefined
            ? Number(v.statistics.likeCount)
            : null,
        commentCount:
          v.statistics?.commentCount !== undefined
            ? Number(v.statistics.commentCount)
            : null,
        durationSec: parseIsoDurationSec(v.contentDetails?.duration || ""),
        publishedAt: v.snippet.publishedAt || null,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        langHint:
          v.snippet.defaultAudioLanguage || v.snippet.defaultLanguage || "",
      }),
    );

  const sortedViews = rawVideos
    .map((v: { viewCount: number }) => v.viewCount)
    .sort((a: number, b: number) => a - b);
  const medianViews = sortedViews.length
    ? sortedViews[Math.floor(sortedViews.length / 2)]
    : 0;

  const videos: IngestedChannelVideo[] = rawVideos.map(
    (v: Omit<IngestedChannelVideo, "outlierRatio"> & { langHint: string }) => ({
      youtubeVideoId: v.youtubeVideoId,
      title: v.title,
      description: v.description,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      durationSec: v.durationSec,
      publishedAt: v.publishedAt,
      outlierRatio:
        medianViews > 0
          ? Math.round((v.viewCount / medianViews) * 100) / 100
          : 1,
      thumbnailUrl: v.thumbnailUrl,
    }),
  );

  const rawLang =
    c.snippet?.defaultLanguage ||
    rawVideos.find((v: { langHint: string }) => v.langHint)?.langHint ||
    "";
  const combinedTitles = videos.map((v) => v.title).join(" ");
  const spanishHits = (
    combinedTitles.match(
      /[áéíóúñ¿¡]|\b(cómo|por qué|para|esto|está|todo|sobre|sin|con|pero|más)\b/gi,
    ) || []
  ).length;
  const primaryLanguage = rawLang
    ? rawLang.split("-")[0].toLowerCase()
    : spanishHits >= 4
      ? "es"
      : "en";

  const avatar = c.snippet?.thumbnails?.default?.url || "";
  const safeAvatar =
    /^https:\/\/yt3\.(?:ggpht\.com|googleusercontent\.com)\//.test(avatar)
      ? avatar
      : "";

  return {
    channel: {
      youtubeChannelId: c.id as string,
      handle: (c.snippet?.customUrl as string | undefined) || null,
      title: (c.snippet?.title as string | undefined) || (c.id as string),
      description: ((c.snippet?.description as string | undefined) || "").slice(
        0,
        2000,
      ),
      primaryLanguage,
      avatarUrl: safeAvatar,
      subscriberCount: c.statistics?.hiddenSubscriberCount
        ? null
        : Number(c.statistics?.subscriberCount) || 0,
      videoCount: Number(c.statistics?.videoCount) || 0,
      uploadsPlaylistId,
      medianViews,
    },
    videos,
  };
}

/**
 * Fetches top relevant public comments for a video (1 YouTube quota unit).
 */
export async function videoCommentThreads(
  key: string,
  videoId: string,
  maxResults = 25,
  fetcher: typeof fetch = fetch,
): Promise<{ author: string; text: string; likes: number }[]> {
  try {
    const payload = await youtubeRead(
      key,
      "commentThreads",
      {
        part: "snippet",
        videoId,
        order: "relevance",
        textFormat: "plainText",
        maxResults: String(Math.min(50, maxResults)),
      },
      fetcher,
    );
    return (Array.isArray(payload.items) ? payload.items : [])
      .map(
        (item: {
          snippet?: {
            topLevelComment?: {
              snippet?: {
                authorDisplayName?: string;
                textDisplay?: string;
                likeCount?: number;
              };
            };
          };
        }) => {
          const s = item?.snippet?.topLevelComment?.snippet;
          return {
            author: (s?.authorDisplayName || "Viewer").slice(0, 60),
            text: (s?.textDisplay || "").trim().slice(0, 400),
            likes: Number(s?.likeCount) || 0,
          };
        },
      )
      .filter((c: { text: string }) => c.text.length > 0);
  } catch {
    return [];
  }
}
