from setuptools import setup, find_packages

setup(
    name="stellar-did-sdk",
    version="1.0.0",
    description="Official Python SDK for Stellar DID Platform",
    packages=find_packages(),
    install_requires=[
        "requests>=2.25.1"
    ],
    python_requires=">=3.7",
)