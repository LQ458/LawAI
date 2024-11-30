import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  // Check if the text is valid
  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "Text to summarize is required" });
  }

  const AK = process.env.BAIDU_AK;
  const SK = process.env.BAIDU_SK;

  try {
    // Request access token
    const options = {
      method: "POST",
      url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`,
    };

    // Handle the promise chain
    return axios(options)
      .then((keyresponse) => {
        const accessToken = keyresponse.data.access_token;

        // Second request for summary
        return axios({
          method: "POST",
          url: `https://aip.baidubce.com/rpc/2.0/nlp/v1/news_summary?charset=UTF-8&access_token=${accessToken}`,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            content: text,
            max_summary_len: 500,
          }),
        });
      })
      .then((response) => {
        // Return the summary in the response
        return NextResponse.json({ summary: response.data.summary });
      })
      .catch((error) => {
        // Handle errors during API calls
        console.error("Error calling AI summarization API:", error);
        return NextResponse.json({ summary: "Failed to summarize" });
      });
  } catch (error) {
    // Catch any unforeseen errors
    console.error("Unexpected error:", error);
    return NextResponse.json({ summary: "Failed to summarize" });
  }
}
