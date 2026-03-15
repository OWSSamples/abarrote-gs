import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file || !path) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const Bucket = process.env.AWS_S3_BUCKET || 'kiosko-blob';

    await s3Client.send(
      new PutObjectCommand({
        Bucket,
        Key: path,
        Body: buffer,
        ContentType: file.type,
        // ACL: 'public-read', // Deprecated generally, let's assume bucket policy allows it
      })
    );

    const url = `https://${Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${path}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error uploading to S3:', error);
    return NextResponse.json({ error: 'Fallo al subir archivo: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url;

    if (!url) {
      return NextResponse.json({ error: 'Falta la URL' }, { status: 400 });
    }

    const Bucket = process.env.AWS_S3_BUCKET || 'kiosko-blob';
    // Extract key from URL
    // e.g. https://kiosko-blob.s3.us-east-2.amazonaws.com/products/123.jpg
    const key = url.split('.amazonaws.com/')[1];

    if (key) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket,
          Key: key,
        })
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting from S3:', error);
    return NextResponse.json({ error: 'Fallo al eliminar archivo: ' + error.message }, { status: 500 });
  }
}
