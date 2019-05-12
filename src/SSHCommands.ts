import * as vscode from 'vscode';
const SSH = require('simple-ssh');
const network = require('network');

export class SSHCommands {
	private ssh: any;
	private appName: string = <string> vscode.workspace.name;

	constructor(private ip: string)
	{
		this.ssh = new SSH({
			host: ip,
			user: 'torizon',
			pass: 'torizon'
		});
	}

	runDockerWithMyRegistry(): Promise<boolean> {

		let ssh = this.ssh;

		/* first get my local ip */
		return new Promise(resolve => {
			network.get_active_interface(function(err: any, obj: any) {
				if (!err) {
					let myip = obj.ip_address;
					ssh.exec(`echo 'torizon' | sudo -S bash -c "echo '{ \\\"insecure-registries\\\" : [\\\"${myip}:5000\\\"] }' > /etc/docker/daemon.json && systemctl restart docker"`, {
						out: function(stdout: string) {
							/* we will never reach this */
							console.log(stdout);
							resolve(false);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							console.log(code);
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				} else {
					vscode.window.showWarningMessage("No internet connection? 🤔");
					resolve(false);
				}
			});
		});
	}

	pullImageFromMyRegistry(name: string, winOut: vscode.OutputChannel): Promise<boolean> {
		let ssh = this.ssh;

		/* first get my local ip */
		return new Promise(resolve => {
			network.get_active_interface(function(err: any, obj: any) {
				if (!err) {
					let myip = obj.ip_address;
					ssh.exec(`docker pull ${myip}:5000/${name}`, {
						out: function(stdout: string) {
							winOut.appendLine("✔️" + stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				} else {
					vscode.window.showWarningMessage("No internet connection? 🤔");
					resolve(false);
				}
			});
		});
	}

	startContainer(name: string): void 
	{
		this.ssh.exec(`docker start ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim()) {
					vscode.window.showInformationMessage(`${name} started 😎`);
				} else {
					vscode.window.showErrorMessage(`Error trying to start ${name}`);
				}
			},
			err: function(stderr: string) {
				vscode.window
					.showErrorMessage(stderr);
			},
		}).start();
	}

	stopContainer(name: string): void
	{
		this.ssh.exec(`docker stop ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim()) {
					vscode.window.showInformationMessage(`${name} stoped 😎`);
				} else {
					vscode.window.showErrorMessage(`Error trying to stop ${name}`);
				}
			},
			err: function(stderr: string) {
				vscode.window
					.showErrorMessage(stderr);
			},
		}).start();
	}

	restartContainer(name: string): void
	{
		this.ssh.exec(`docker restart ${name}`, {
			out: function(stdout: string) {
				if (name == stdout.trim())
					vscode.window.showInformationMessage(`${name} restarted 😎`);
				else
					vscode.window.showErrorMessage(`Error trying to restart ${name}`);
			},
			err: function(stderr: string) {
				vscode.window
					.showErrorMessage(stderr);
			},
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
								vscode.window.showInformationMessage(`${name} removed 😎`);
								resolve(true);
							} else {
								vscode.window.showErrorMessage(`Error trying to remove ${name}`);
								resolve(false);
							}
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
					}).start();
				}
			});
		});
	}

	runImage(name: string): Promise<boolean>
	{
		return new Promise(resolve => {
			/* normal run */
			this.ssh.exec(`docker run --name ${this.appName} -d -it ${name}`, {
				out: function(stdout: string) {
					console.log(stdout);
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				},
				exit: function(code: any) {
					if (code === 0)
						resolve(true);
					else
						resolve(false);
				}
			}).start();
		});
	}

	runXorgImage(name: string): Promise<boolean>
	{
		return new Promise(resolve => {
			/* normal run */
			this.ssh.exec(`docker run --name ${this.appName} \
			-d -it --privileged \
			-v /var/run/dbus:/var/run/dbus \
			-v /dev:/dev ${name}`, {
				out: function(stdout: string) {
					console.log(stdout);
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				},
				exit: function(code: any) {
					if (code === 0)
						resolve(true);
					else
						resolve(false);
				}
			}).start();
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
				},
				err: function(stderr: string) {
					vscode.window
						.showErrorMessage(stderr);
				}
			}).start();
		});
	}

	deleteImage(id: string): Promise<boolean>
	{
		let options: vscode.InputBoxOptions = {
			prompt: "",
			placeHolder: "Are you sure you want to remove this Image?"
		}

		return new Promise(resolve => {
			vscode.window.showInputBox(options).then(value => {
				if (value != undefined) {
					this.ssh.exec(`docker rmi ${id}`, {
						out: function(stdout: string) {
							console.log(stdout);
						},
						err: function(stderr: string) {
							vscode.window
								.showErrorMessage(stderr);
						},
						exit: function(code: any) {
							if (code === 0)
								resolve(true);
							else
								resolve(false);
						}
					}).start();
				}
			});
		});
	}
}
