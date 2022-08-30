import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {

  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE: string = 'photos';
  private platform: Platform;

  constructor(platForm: Platform) {
    this.platform = platForm;
  }

  public async addNewToGallery(): Promise<void> {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });
    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    })
  }

  public async loadSaved() {
    const photoList = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value) || [];
    if (!this.platform.is('hybrid')) {
      for (let photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filePath,
          directory: Directory.Data
        });
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  public async deletePicture(photo: UserPhoto, position: number): Promise<void> {
    this.photos.splice(position, 1);
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });
    const fileName = photo.filePath.substr(photo.filePath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Data
    });
  }

  private async savePicture(photo: Photo): Promise<UserPhoto> {
    const base64Data = await this.readAsBase64(photo);
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      directory: Directory.Data,
      data: base64Data
    });
    if (this.platform.is('hybrid')) {
      return {
        filePath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      }
    } else {
      return {
        filePath: fileName,
        webviewPath: photo.webPath
      }
    }
  }

  private async readAsBase64(photo: Photo): Promise<string> {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path
      });
      return file.data;
    } else {
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      return await this.convertBlobToBase64(blob) as string;
    }
  }

  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    }
    reader.readAsDataURL(blob);
  });
}

export interface UserPhoto {
  filePath: string;
  webviewPath: string;
}