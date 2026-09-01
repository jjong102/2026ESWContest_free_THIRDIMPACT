from setuptools import find_packages, setup

package_name = 'GDM'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='moonshot',
    maintainer_email='ky942400@gmail.com',
    description='TODO: Package description',
    license='TODO: License declaration',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'make_clear_floor_plan_node = GDM.make_clear_floor_plan_node:main',
            'room_segmentation_node = GDM.room_segmentation_node:main',
            'web_server_node = GDM.web_server_node:main',
            'MQTT_sub_node = GDM.MQTT_sub_node:main',
            'test_robot_state_node = GDM.test_robot_state_node:main',
            'robot_state_sub_node = GDM.robot_state_sub_node:main',
        ],
    },
)
