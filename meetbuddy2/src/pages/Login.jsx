import React from "react";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Login = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-col justify-center items-center mt-16 px-4">
        <Card className="w-full max-w-md shadow-lg border rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Login to MeetBuddy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username or Email</label>
              <Input type="text" placeholder="Enter your email" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input type="password" placeholder="Enter your password" />
            </div>
            <Button className="w-full mt-2">Login</Button>

            <div className="relative text-center my-4">
              <span className="text-sm text-muted-foreground">or</span>
            </div>

            <Button variant="outline" className="w-full">Login with Google</Button>
            <Button variant="outline" className="w-full">Login with Phone Number</Button>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-gray-600 text-center">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-blue-600 hover:underline font-medium">
            Click here to signup
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
