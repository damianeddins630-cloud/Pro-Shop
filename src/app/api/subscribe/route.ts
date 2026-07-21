import { NextResponse } from "next/server";
import { z } from "zod";
import { addSubscriber } from "@/lib/store";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  city: z.string().min(1),
  state: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const subscriber = await addSubscriber(body);
    return NextResponse.json({ subscriber }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Subscribe failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
