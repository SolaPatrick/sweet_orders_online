<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Uploads extends MY_Api_Controller
{
    public function design()
    {
        $this->api->require_method('POST');
        $user = $this->user();
        $this->api->rate_limit('design:' . $user['id'], 10, 3600);
        if (!$this->request->has_file('photo')) {
            $this->fail_validation(['photo' => 'Please choose a photo to upload.']);
        }
        $file = $this->request->file('photo');
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            $this->fail_validation(['photo' => 'The photo must be 5 MB or smaller.']);
        }

        $this->call->library('cloudinary');
        $to_cloud = $this->cloudinary->enabled();
        $local_dir = ROOT_DIR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'designs' . DIRECTORY_SEPARATOR;
        if (!$to_cloud && !is_dir($local_dir)) {
            @mkdir($local_dir, 0755, true);
        }
        $this->call->library('upload', $file);
        $this->upload
            ->set_dir($to_cloud ? ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'uploads' : $local_dir)
            ->allowed_extensions(['jpg', 'jpeg', 'png', 'webp'])
            ->allowed_mimes(['image/jpeg', 'image/png', 'image/webp'])
            ->max_size(5)
            ->is_image()
            ->encrypt_name();
        if (!$this->upload->do_upload()) {
            $this->fail_validation(['photo' => implode(' ', $this->upload->get_errors())]);
        }

        $name = $this->upload->get_filename();
        $url = base_url('uploads/designs/' . $name);
        if ($to_cloud) {
            $tmp = ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $name;
            try {
                $url = $this->cloudinary->upload($tmp, 'sweet-orders/design-references');
            } catch (RuntimeException $e) {
                $this->logger->log('error', 'Upload', 'Design photo upload failed: ' . $e->getMessage(), $e->getFile(), $e->getLine());
                $this->api->respond_error('The photo could not be saved right now. Please try again in a few minutes.', 502);
            } finally {
                @unlink($tmp);
            }
        }

        $this->call->model('Design_upload_model');
        $id = $this->Design_upload_model->insert(['user_id' => (int) $user['id'], 'url' => $url]);
        $this->api->respond(['message' => 'Photo uploaded.', 'data' => ['id' => (int) $id, 'url' => $url]], 201);
    }
}
