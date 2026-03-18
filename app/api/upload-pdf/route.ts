// app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";

// 修正ポイント1: Vercel上で確実に標準的なNode.jsサーバーとして動かすための記述
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 修正ポイント2: ビルドエラーを回避しつつ、Vercel環境で確実にモジュールを読み込む
    const pdfParseModule = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;

    // pdf-parseを使ってテキスト化
    const pdfData = await pdfParse(buffer);
    const extractedText = pdfData.text; 

    // OpenAIへファイルをアップロード
    const openAiFormData = new FormData();
    openAiFormData.append("purpose", "assistants");
    openAiFormData.append("file", file);

    const response = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      },
      body: openAiFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message }, { status: response.status });
    }

    return NextResponse.json({
      ...data,
      extractedText: extractedText,
    });
    
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("PDF Upload Error:", error);
    // 修正ポイント3: フロントエンドに詳細なエラー理由(details)を確実に返す
    return NextResponse.json(
      { 
        error: "サーバー内部エラーが発生しました", 
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}


// // app/api/upload-pdf/route.ts
// import { NextResponse } from "next/server";

// export async function POST(req: Request) {
//   try {
//     // フロントエンドから送られたファイルを受け取る
//     const formData = await req.formData();
//     const file = formData.get("file");

//     if (!file) {
//       return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
//     }

//     // OpenAIに転送するためのFormDataを作成
//     const openAiFormData = new FormData();
//     openAiFormData.append("purpose", "assistants");
//     openAiFormData.append("file", file);

//     // サーバー側からOpenAIのAPIを叩く
//     const response = await fetch("https://api.openai.com/v1/files", {
//       method: "POST",
//       headers: {
//         // サーバー側なので環境変数を安全に読み込める
//         Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
//       },
//       body: openAiFormData,
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       return NextResponse.json({ error: data.error?.message }, { status: response.status });
//     }

//     return NextResponse.json(data);
//   } catch (error) {
//     console.error(error);
//     return NextResponse.json({ error: "サーバー内部エラーが発生しました" }, { status: 500 });
//   }
// }