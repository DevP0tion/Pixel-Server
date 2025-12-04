import { firebaseAuth as auth } from "../../../hooks.server.js"

export async function POST({ request }) {
  // Registration logic will go here
  const { email, password } = await request.json();

  try {
    const user = await auth.createUser({
      email: email,
      password: password
    });

    const token = await auth.createCustomToken(user.uid);

    return new Response(JSON.stringify({ 
      message: "User created successfully",
      uid: user.uid,
      token: token
    }), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ message: (error as Error).message }), { status: 400 });
  }
}