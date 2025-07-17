import React from "react";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Signup = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-col justify-center items-center mt-16 px-4">
        <Card className="w-full max-w-md shadow-lg border rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Signup for MeetBuddy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <Input type="text" placeholder="First Name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <Input type="text" placeholder="Last Name" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email ID</label>
              <Input type="email" placeholder="Enter your email" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <Input type="tel" placeholder="Enter your phone number" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input type="text" placeholder="Choose a username" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input type="password" placeholder="Enter your password" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Repeat Password</label>
              <Input type="password" placeholder="Repeat your password" />
            </div>
            <Button className="w-full mt-2">Signup</Button>

            <div className="relative text-center my-4">
              <span className="text-sm text-muted-foreground">or</span>
            </div>

            <Button variant="outline" className="w-full">Signup with Google</Button>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-gray-600 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Click to login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
