import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Advisory ML integrations. Forecast history is synthetic until real usage is connected. */
export class AiService {
  static async getMaterialDemandForecast() {
    const repositoryRoot = path.resolve(__dirname, '../../../');
    const scriptPath = path.join(repositoryRoot, 'ml', 'demand_forecast');
    const projectPython = path.join(
      repositoryRoot,
      'ml',
      '.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
    );
    const python = process.env.PYTHON_EXECUTABLE || (require('fs').existsSync(projectPython) ? projectPython : 'python');
    const inline = [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(scriptPath)})`,
      'from forecast import load_history, evaluate, forecast',
      'history = load_history()',
      'names = history.drop_duplicates("material_id").set_index("material_id")["material_name"].to_dict()',
      'predictions = forecast(history, horizon_months=12)',
      'for item in predictions: item["material_name"] = str(names[item["material_id"]])',
      'print(json.dumps({"source": "synthetic_csv", "demo_data": True, "reports": evaluate(history), "predictions": predictions}))'
    ].join('; ');

    const { stdout } = await execFileAsync(python, ['-c', inline], {
      cwd: repositoryRoot,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    });
    return JSON.parse(stdout.trim());
  }

  static analyzeRoofPhotograph() {
    return {
      status: 'MODEL_NOT_CONFIGURED',
      detected_elements: [],
      notice: 'No computer-vision model is configured yet. The customer photo is attached for the technician to inspect in person.'
    };
  }
}
