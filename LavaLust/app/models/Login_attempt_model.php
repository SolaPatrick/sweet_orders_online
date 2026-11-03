<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Login_attempt_model extends Model
{
    protected $table = 'login_attempts';
    protected $fillable = ['email', 'user_id', 'success', 'reason', 'ip', 'user_agent'];

    public const MAX_FAILURES = 5;

    public const WINDOW_MINUTES = 15;

    private const COUNTED = ['wrong_password', 'unknown_email'];

    public function record(string $email, $user_id, bool $success, string $reason, string $ip, string $user_agent): void
    {
        $this->db->table($this->table)->insert([
            'email'      => mb_substr($email, 0, 255),
            'user_id'    => $user_id ? (int) $user_id : null,
            'success'    => $success ? 1 : 0,
            'reason'     => $reason,
            'ip'         => mb_substr($ip, 0, 45),
            'user_agent' => $user_agent !== '' ? mb_substr($user_agent, 0, 255) : null,
        ]);
    }

    public function locked_until(string $email)
    {
        $since = date('Y-m-d H:i:s', time() - self::WINDOW_MINUTES * 60);
        $last_ok = $this->db->table($this->table)
            ->select('created_at')
            ->where('email', $email)
            ->where('success', 1)
            ->order_by('id', 'DESC')
            ->limit(1)
            ->get();
        if ($last_ok && $last_ok['created_at'] > $since) {
            $since = $last_ok['created_at'];
        }
        $fails = $this->db->table($this->table)
            ->select('created_at')
            ->where('email', $email)
            ->where('success', 0)
            ->in('reason', self::COUNTED)
            ->where('created_at', '>', $since)
            ->order_by('id', 'DESC')
            ->limit(self::MAX_FAILURES)
            ->get_all();
        if (count($fails) < self::MAX_FAILURES) {
            return null;
        }
        $oldest = end($fails)['created_at'];
        $until = strtotime($oldest) + self::WINDOW_MINUTES * 60;
        return $until > time() ? $until : null;
    }

    public function recent(bool $failed_only, string $q, int $limit, int $offset): array
    {
        $this->filtered($failed_only, $q)
            ->select('a.id, a.email, a.user_id, a.success, a.reason, a.ip, a.user_agent, a.created_at, u.name AS user_name, u.role AS user_role')
            ->order_by('a.id', 'DESC')
            ->limit($limit, $offset);
        return array_map(function ($a) {
            $a['id'] = (int) $a['id'];
            $a['user_id'] = $a['user_id'] !== null ? (int) $a['user_id'] : null;
            $a['success'] = (int) $a['success'];
            return $a;
        }, $this->db->get_all());
    }

    public function count_recent(bool $failed_only, string $q): int
    {
        return (int) $this->filtered($failed_only, $q)->select_count('*', 'n')->get()['n'];
    }

    public function failed_since(string $since): int
    {
        return (int) $this->db->table($this->table)->where('success', 0)->where('created_at', '>=', $since)->count();
    }

    private function filtered(bool $failed_only, string $q)
    {
        $this->db->table('login_attempts a')->left_join('users u', 'u.id = a.user_id');
        if ($failed_only) {
            $this->db->where('a.success', 0);
        }
        if ($q !== '') {
            $like = '%' . $q . '%';
            $this->db->grouped(function ($db) use ($like) {
                $db->like('a.email', $like)->or_like('a.ip', $like);
            });
        }
        return $this->db;
    }
}
