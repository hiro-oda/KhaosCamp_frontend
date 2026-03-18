// app/api/upload-pdf/route.ts
import { NextResponse } from "next/server";

// 修正: 'import pdfParse from "pdf-parse";' を削除しました

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    }

    // --- 1. PDFからテキストを抽出する処理 ---
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 修正: ESMのimportエラーを回避するため、Node.jsのrequireを使用する
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse");
    
    // pdf-parseを使ってテキスト化
    const pdfData = await pdfParse(buffer);
    const extractedText = pdfData.text; // これが抽出されたテキスト

    // --- 2. OpenAIへファイルをアップロードする処理 ---
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

    // OpenAIからのレスポンス(File IDなど)に加えて、抽出したテキストもフロントエンドに返す
    return NextResponse.json({
      ...data,
      extractedText: extractedText,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "サーバー内部エラーが発生しました" }, { status: 500 });
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