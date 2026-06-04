"""
机械选型 App Flask 服务端
运行: python server.py
访问: http://localhost:5001
"""
import glob
import os
import subprocess
import tempfile
from flask import Flask, send_from_directory, send_file, request, jsonify

APP_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


@app.route('/')
def index():
    return send_file(os.path.join(APP_DIR, 'index.html'), mimetype='text/html')


@app.route('/style.css')
def style_css():
    return send_file(os.path.join(APP_DIR, 'style.css'), mimetype='text/css')


@app.route('/app.js')
def app_js():
    return send_file(os.path.join(APP_DIR, 'app.js'), mimetype='application/javascript')


@app.route('/data.js')
def data_js():
    return send_file(os.path.join(APP_DIR, 'data.js'), mimetype='application/javascript')


@app.route('/app.bundled.js')
def app_bundled_js():
    return send_file(os.path.join(APP_DIR, 'app.bundled.js'), mimetype='application/javascript')


@app.route('/midas-viewer.js')
def midas_viewer_js():
    return send_file(os.path.join(APP_DIR, 'midas-viewer.js'), mimetype='application/javascript')


@app.route('/crane_images/<path:filename>')
def crane_images(filename):
    return send_from_directory(os.path.join(APP_DIR, 'crane_images'), filename)


# ─────────────────────────────────────────────
# MGB → MGT 转换接口
# ─────────────────────────────────────────────

def _find_midas_gen_exe():
    patterns = [
        r'C:\Program Files\MIDAS\Gen\*\Gen.exe',
        r'C:\Program Files (x86)\MIDAS\Gen\*\Gen.exe',
        r'C:\MIDAS\Gen\*\Gen.exe',
        r'D:\Program Files\MIDAS\Gen\*\Gen.exe',
        r'D:\MIDAS\Gen\*\Gen.exe',
    ]
    for p in patterns:
        matches = glob.glob(p)
        if matches:
            return matches[0]
    for d in os.environ.get('PATH', '').split(os.pathsep):
        for n in ('Gen.exe', 'MidasGen.exe', 'midas.exe'):
            candidate = os.path.join(d, n)
            if os.path.isfile(candidate):
                return candidate
    return None


def _convert_mgb_via_midas(mgb_path):
    exe = _find_midas_gen_exe()
    if not exe:
        return None, 'Midas Gen 未安装或未找到可执行文件'
    tmp_dir = tempfile.mkdtemp(prefix='mgb_conv_')
    mgt_path = os.path.join(tmp_dir, 'output.mgt')
    try:
        for cmd in [
            [exe, '/export', mgb_path, '/mgt', mgt_path],
            [exe, '-export', mgb_path, '-mgt', mgt_path],
            [exe, mgb_path, '/mgt', mgt_path],
        ]:
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd=tmp_dir)
                if os.path.isfile(mgt_path) and os.path.getsize(mgt_path) > 100:
                    with open(mgt_path, 'r', encoding='utf-8', errors='replace') as f:
                        return f.read(), None
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
        return None, 'Midas Gen 命令行导出失败，请在 Midas Gen 软件中手动导出 MGT 文件'
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


@app.route('/api/parse_mgb', methods=['POST'])
def parse_mgb():
    import struct
    if 'file' not in request.files:
        return jsonify({'error': '未收到文件，请重新上传'}), 400
    f = request.files['file']
    filename = f.filename or 'model.mgb'
    if not filename.lower().endswith('.mgb'):
        return jsonify({'error': '仅支持 .mgb 格式文件'}), 400
    mgb_data = f.read()
    if len(mgb_data) < 20 or mgb_data[:4] != b'MGEN':
        return jsonify({'error': '非有效的 Midas MGB 文件'}), 400

    meta = {}
    TAG_NAMES = ['HEAD','VERS','PGIF','UNIT','PJCF','STYP','STCI','SECC','ACOP','BNGR',
                 'LDGR','NODE','ELEM','MATL','MATD','CO_M','SECT','SECD','CO_S','THIK']
    cursor = 20 + 20 * 20
    for i in range(20):
        off = 20 + i * 20
        if off + 20 > len(mgb_data):
            break
        cnt = struct.unpack_from('<I', mgb_data, off + 16)[0]
        tag = TAG_NAMES[i]
        if tag == 'NODE': meta['node_count'] = cnt
        elif tag == 'ELEM': meta['elem_count'] = cnt
        elif tag == 'SECT': meta['sect_count'] = cnt
        cursor += struct.unpack_from('<I', mgb_data, off + 12)[0]

    with tempfile.NamedTemporaryFile(suffix='.mgb', delete=False) as tmp:
        tmp.write(mgb_data)
        tmp_mgb_path = tmp.name
    try:
        mgt_text, err = _convert_mgb_via_midas(tmp_mgb_path)
    finally:
        try:
            os.unlink(tmp_mgb_path)
        except Exception:
            pass

    if mgt_text:
        return jsonify({'mgt_content': mgt_text})

    nc = meta.get('node_count', '未知')
    ec = meta.get('elem_count', '未知')
    sc = meta.get('sect_count', '未知')
    msg = (
        f'MGB 是 Midas Gen 私有二进制格式，需要借助 Midas Gen 软件才能解析。\n\n'
        f'文件信息：节点 {nc} 个 / 单元 {ec} 个 / 截面 {sc} 种\n\n'
        f'解决方法：在 Midas Gen 中打开 .mgb 文件，菜单 File → Export → MGT Text File，\n'
        f'导出为 .mgt 文件后再导入本工具。'
    )
    return jsonify({'error': msg, 'meta': {
        'node_count': nc, 'elem_count': ec, 'sect_count': sc,
        'file_size_kb': round(len(mgb_data) / 1024, 1),
    }}), 422


if __name__ == '__main__':
    print('=' * 50)
    print('  吊机选型 App')
    print('  http://localhost:5001')
    print('  Ctrl+C 停止')
    print('=' * 50)
    app.run(host='0.0.0.0', port=5001, debug=False)
