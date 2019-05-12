import * as vscode from 'vscode';
const SSH = require('simple-ssh');

export class SSHCommands {
	private ssh: any;

	constructor(private ip: string)
	{
		this.ssh = new SSH({
			host: ip,
			user: 'torizon',
			pass: 'torizon'
		});
	}

	startContainer(name: string): void 
	{
		this.ssh.exec(`docker start ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim()) {
					vscode.window.showInformationMessage(`${name} started`);
				} else {
					vscode.window.showErrorMessage(`Error trying to start ${name}`);
				}
			}
		}).start();
	}

	stopContainer(name: string): void
	{
		this.ssh.exec(`docker stop ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim()) {
					vscode.window.showInformationMessage(`${name} stoped`);
				} else {
					vscode.window.showErrorMessage(`Error trying to stop ${name}`);
				}
			}
		}).start();
	}

	restartContainer(name: string): void
	{
		this.ssh.exec(`docker restart ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim())
					vscode.window.showInformationMessage(`${name} restarted`);
				else
					vscode.window.showErrorMessage(`Error trying to restart ${name}`);
			}
		}).start();
	}

	deleteContainer(name: string): Promise<boolean>
	{
		//vscode.window.showQuickPick(["Yes", "No"]);

		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "Are you sure you want to remove this container?"
		}
		
		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(value => {
				if (value != undefined) {
					/* so this is an yes */
					this.ssh.exec(`docker rm -vf ${name}`, {
						out: function(stdout: string) {
							if (name == stdout.trim()) {
								vscode.window.showInformationMessage(`${name} removed`);
								resolve(true);
							} else {
								vscode.window.showErrorMessage(`Error trying to remove ${name}`);
								resolve(false);
							}
						}
					}).start();
				}
			});
		});
	}

	runImage(name: string): Promise<boolean>
	{
		return new Promise(resolve => {
			vscode.window.showInputBox();
			resolve(false);
		});
	}

	importImage(fileName: string, out: vscode.OutputChannel): Promise<boolean>
	{
		return new Promise(resolve => {
			this.ssh.exec(`docker load --input /home/torizon/${fileName}`, {
				out: function(stdout: string) {
					console.log(stdout);
					out.appendLine("");
					out.appendLine(stdout);

					if (stdout.indexOf("Loaded") != -1) {
						resolve(true);
					} else {
						resolve(false);
					}
				}
			}).start();
		});
	}
}
