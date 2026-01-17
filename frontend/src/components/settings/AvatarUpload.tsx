"use client";

import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FiCamera, FiUpload, FiX, FiCheck } from "react-icons/fi";
import { toast } from "react-hot-toast";

export function AvatarUpload() {
  const { user, refreshAuth } = useAuth();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      // Convert base64 to blob
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          uploadFile(file);
          setIsCameraOpen(false);
        });
    }
  }, [webcamRef]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      // 1. Get presigned URL
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string; key: string }>(
        "/me/avatar-upload-url",
        {
          contentType: file.type,
        }
      );

      // 2. Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // 3. Update user profile
      await api.patch("/me", {
        profile_photo_url: publicUrl,
      });

      // 4. Refresh user context
      await refreshAuth();
      toast.success("Profile photo updated successfully");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to update profile photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
      <div className="relative">
        <Avatar
          src={user?.profile_photo_url}
          alt={user?.name || "User"}
          fallback={user?.name || user?.email || "U"}
          className="h-24 w-24 text-2xl border-4 border-white shadow-lg"
        />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 items-center sm:items-start text-center sm:text-left">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Profile Photo
        </h3>
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <FiUpload className="w-4 h-4 mr-2" />
            Upload Photo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCameraOpen(true)}
            disabled={uploading}
          >
            <FiCamera className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Recommended size: 400x400px. JPG, PNG or GIF.
        </p>
      </div>

      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <div className="relative aspect-video bg-gray-900">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{
                  facingMode: "user",
                }}
              />
            </div>
            
            <div className="flex items-center justify-between p-6 bg-gray-900/50">
              <button
                onClick={() => setIsCameraOpen(false)}
                className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
              
              <button
                onClick={capture}
                className="p-4 bg-white text-black rounded-full hover:scale-110 hover:shadow-lg hover:shadow-white/20 transition-all duration-200"
              >
                <FiCamera className="w-6 h-6" />
              </button>
              
              <div className="w-12" /> {/* Spacer for centering */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
