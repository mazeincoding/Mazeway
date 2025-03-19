"use client";

import { useState } from "react";

export default function TestEmail() {
  const [result, setResult] = useState<string>("");

  const testEmail = async () => {
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(String(error));
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Test Email Route</h1>
      <button
        onClick={testEmail}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Test Route
      </button>
      <pre className="mt-4 p-4 bg-gray-100 rounded">
        {result || "Click button to test"}
      </pre>
    </div>
  );
}
